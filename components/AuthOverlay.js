'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Play, ShieldAlert, ArrowRight } from 'lucide-react';

export default function AuthOverlay({ 
  dbStatus, 
  onRetryDb, 
  onAuthSuccess, 
  appendLog 
}) {
  // Wizard state: 'db' | 'welcome' | 'login' | 'register'
  const [cardState, setCardState] = useState('db');
  
  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register wizard states
  const [regStep, setRegStep] = useState(1); // 1, 2, or 3
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regPassword, setRegPassword] = useState('');
  
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpButtonText, setOtpButtonText] = useState('Get OTP Code');
  const [isOtpCountingDown, setIsOtpCountingDown] = useState(false);
  const [otpVerifyLoading, setOtpVerifyLoading] = useState(false);
  const [regCompleteLoading, setRegCompleteLoading] = useState(false);

  // Monitor database connection status
  useEffect(() => {
    if (cardState === 'db') {
      if (dbStatus === true) {
        setCardState('welcome');
      }
    }
  }, [dbStatus, cardState]);

  // Handle Login submission
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword) {
      alert('Please enter your username/email and password.');
      return;
    }

    setLoginLoading(true);
    try {
      const result = await window.electronAPI.authLogin(loginIdentifier.trim(), loginPassword);
      if (result.success) {
        appendLog(`Successfully logged in as: ${result.user.username}`, 'success-log');
        onAuthSuccess(result.user);
      } else {
        alert(`Login failed: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error during login process');
    } finally {
      setLoginLoading(false);
    }
  };

  // Step 1: Send Username & Email for OTP Dispatch
  const handleRequestOtp = async () => {
    if (!regUsername.trim() || !regEmail.trim()) {
      alert('Please fill out both username and email address fields.');
      return;
    }

    // Disable inputs and trigger 3-second animated countdown
    setOtpLoading(true);
    setIsOtpCountingDown(true);
    let secondsRemaining = 3;
    setOtpButtonText(`Requesting OTP in ${secondsRemaining}s...`);

    const countdownInterval = setInterval(() => {
      secondsRemaining--;
      if (secondsRemaining > 0) {
        setOtpButtonText(`Requesting OTP in ${secondsRemaining}s...`);
      } else {
        clearInterval(countdownInterval);
      }
    }, 1000);

    // Wait exactly 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
    setOtpButtonText('Sending OTP...');

    try {
      const result = await window.electronAPI.authRequestOtp(regUsername.trim(), regEmail.trim());
      if (result.success) {
        setRegStep(2);
        appendLog(`Verification OTP generated and sent to: ${regEmail.trim()}`, 'system-log');
      } else {
        alert(`Failed to send OTP: ${result.error}`);
        // Unlock on fail so user can fix credentials
        setIsOtpCountingDown(false);
      }
    } catch (err) {
      console.error(err);
      alert('Error requesting OTP');
      setIsOtpCountingDown(false);
    } finally {
      setOtpLoading(false);
      setOtpButtonText('Get OTP Code');
    }
  };

  // Step 2: Validate OTP
  const handleVerifyOtp = async () => {
    if (!regOtp.trim()) {
      alert('Please enter the 6-digit OTP code.');
      return;
    }

    setOtpVerifyLoading(true);
    try {
      const result = await window.electronAPI.authVerifyOtp(regEmail.trim(), regOtp.trim());
      if (result.success) {
        setRegStep(3);
        appendLog('OTP verified successfully. Please enter your password.', 'system-log');
      } else {
        alert(`Verification failed: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error verifying OTP');
    } finally {
      setOtpVerifyLoading(false);
    }
  };

  // Step 3: Complete registration password save
  const handleCompleteRegister = async (e) => {
    e.preventDefault();
    if (!regPassword || regPassword.length < 4) {
      alert('Please enter a password containing at least 4 characters.');
      return;
    }

    setRegCompleteLoading(true);
    try {
      const result = await window.electronAPI.authRegister(regEmail.trim(), regPassword);
      if (result.success) {
        appendLog(`Account created and registered successfully: ${result.user.username}`, 'success-log');
        onAuthSuccess(result.user);
      } else {
        alert(`Registration failed: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error finalizing registration');
    } finally {
      setRegCompleteLoading(false);
    }
  };

  // Switch to register wizard
  const showRegisterForm = () => {
    setRegStep(1);
    setRegUsername('');
    setRegEmail('');
    setRegOtp('');
    setRegPassword('');
    setIsOtpCountingDown(false);
    setCardState('register');
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#070a0f] flex items-center justify-center select-none overflow-hidden">
      {/* Main Auth Card */}
      <div className="bg-bg-header border border-border-color rounded-2xl w-[400px] shadow-2xl p-6 flex flex-col gap-6 text-[12px] relative overflow-hidden">
        {/* Title Header */}
        <div className="flex flex-col items-center gap-2 text-center border-b border-border-color/50 pb-5">
          <img 
            src="/logo.png" 
            className="w-16 h-16 object-contain rounded-2xl shadow-[0_0_15px_rgba(59,130,246,0.15)] mb-2" 
            alt="Logo" 
          />
          <h2 className="text-base font-bold tracking-widest text-text-primary capitalize">ELECTRON EXECUTOR</h2>
          <p className="text-[10px] text-text-muted">A premium, secure, and next-generation Roblox script executor</p>
        </div>

        <AnimatePresence mode="wait">
          {/* CARD 1: PostgreSQL Server Connecting/Offline View */}
          {cardState === 'db' && (
            <motion.div
              key="db"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4 items-center justify-center py-4"
            >
              {dbStatus === false ? (
                <>
                  <ShieldAlert className="text-red-500 w-12 h-12 mb-2" />
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-1">Database Offline</h3>
                    <p className="text-[11px] text-text-secondary px-4 leading-relaxed">Could not establish connection to the database. Please ensure PostgreSQL is running.</p>
                  </div>
                  <button 
                    onClick={onRetryDb}
                    className="w-full bg-accent-blue hover:bg-blue-600 text-white font-semibold py-2.5 rounded mt-3 transition-colors duration-150 cursor-pointer shadow-md flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} className="animate-spin-slow" />
                    Retry Connection
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full border-4 border-border-color border-t-accent-blue animate-spin mb-2" />
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-1">Connecting to Server</h3>
                    <p className="text-[11px] text-text-secondary px-4 leading-relaxed">Please wait while we establish a secure connection to the local database server.</p>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* CARD 1.5: Welcome Screen */}
          {cardState === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-5 items-center text-center py-2"
            >
              <div className="text-text-secondary leading-relaxed px-2 text-[11px]">
                Welcome to the next generation of script execution. Discover ultimate stability, lightning-fast script synchronization, and multi-device cloud compatibility.
              </div>
              <button 
                onClick={() => setCardState('login')}
                className="w-full bg-accent-blue hover:bg-blue-600 text-white font-bold py-2.5 rounded mt-3 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
              >
                Get Started
                <ArrowRight size={14} />
              </button>
            </motion.div>
          )}

          {/* CARD 2: User Login Form */}
          {cardState === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider text-center">Login Account</h3>
              <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-text-secondary mb-1">Username or Email</label>
                  <input 
                    type="text" 
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="w-full bg-[#05070a] border border-border-color rounded px-3 py-1.5 text-text-primary focus:outline-none focus:border-accent-blue" 
                    placeholder="Enter username or email"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Password</label>
                  <input 
                    type="password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-[#05070a] border border-border-color rounded px-3 py-1.5 text-text-primary focus:outline-none focus:border-accent-blue" 
                    placeholder="••••••••"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loginLoading}
                  className="smooth-btn bg-accent-blue hover:bg-blue-600 text-white font-semibold py-2.5 rounded mt-3 transition-colors duration-150 cursor-pointer shadow-md w-full"
                >
                  {loginLoading ? 'Logging in...' : 'Login'}
                </button>
                
                <div className="flex justify-between items-center text-[10px] text-text-muted mt-2">
                  <a 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); showRegisterForm(); }}
                    className="hover:text-accent-blue transition-colors duration-150"
                  >
                    Don't have an account? Register
                  </a>
                </div>
              </form>
            </motion.div>
          )}

          {/* CARD 3: User Register Wizard (OTP Flow) */}
          {cardState === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider text-center">Register Account</h3>
              
              <AnimatePresence mode="wait">
                {/* Step 1: Input Username & Email */}
                {regStep === 1 && (
                  <motion.div 
                    key="reg-step-1"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col gap-3.5"
                  >
                    <div>
                      <label className="block text-text-secondary mb-1">Username</label>
                      <input 
                        type="text" 
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        disabled={isOtpCountingDown}
                        className="w-full bg-[#05070a] border border-border-color rounded px-3 py-1.5 text-text-primary focus:outline-none focus:border-accent-blue disabled:opacity-50 disabled:cursor-not-allowed" 
                        placeholder="Enter desired username"
                      />
                    </div>
                    <div>
                      <label className="block text-text-secondary mb-1">Email Address</label>
                      <input 
                        type="email" 
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        disabled={isOtpCountingDown}
                        className="w-full bg-[#05070a] border border-border-color rounded px-3 py-1.5 text-text-primary focus:outline-none focus:border-accent-blue disabled:opacity-50 disabled:cursor-not-allowed" 
                        placeholder="you@example.com"
                      />
                    </div>
                    
                    <motion.button 
                      type="button" 
                      onClick={handleRequestOtp}
                      disabled={otpLoading}
                      animate={isOtpCountingDown ? {
                        backgroundColor: '#1d4ed8',
                        color: '#93c5fd',
                        opacity: 0.8,
                        boxShadow: [
                          "0 0 2px rgba(59, 130, 246, 0.4)",
                          "0 0 8px rgba(59, 130, 246, 0.8)",
                          "0 0 2px rgba(59, 130, 246, 0.4)"
                        ]
                      } : {}}
                      transition={isOtpCountingDown ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
                      className="bg-accent-blue hover:bg-blue-600 text-white font-semibold py-2.5 rounded mt-2 transition-colors duration-150 cursor-pointer shadow-md w-full disabled:cursor-not-allowed"
                    >
                      {otpButtonText}
                    </motion.button>
                  </motion.div>
                )}

                {/* Step 2: Verification OTP */}
                {regStep === 2 && (
                  <motion.div 
                    key="reg-step-2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col gap-3.5"
                  >
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5 text-center text-text-log text-[11px]">
                      A verification code has been dispatched. Enter it below to proceed.
                    </div>
                    <div>
                      <label className="block text-text-secondary mb-1">Verification OTP</label>
                      <input 
                        type="text" 
                        value={regOtp}
                        onChange={(e) => setRegOtp(e.target.value)}
                        className="w-full bg-[#05070a] border border-border-color rounded px-3 py-1.5 text-text-primary focus:outline-none focus:border-accent-blue font-mono tracking-widest text-center text-sm" 
                        placeholder="000000" 
                        maxLength={6}
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={handleVerifyOtp}
                      disabled={otpVerifyLoading}
                      className="bg-accent-blue hover:bg-blue-600 text-white font-semibold py-2.5 rounded mt-2 transition-colors duration-150 cursor-pointer shadow-md w-full"
                    >
                      {otpVerifyLoading ? 'Verifying...' : 'Verify Verification Code'}
                    </button>
                  </motion.div>
                )}

                {/* Step 3: Password Inputs */}
                {regStep === 3 && (
                  <motion.form 
                    key="reg-step-3"
                    onSubmit={handleCompleteRegister}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col gap-3.5"
                  >
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5 text-center text-text-log text-[11px] font-semibold">
                      ✔ Code Verified. Set your access credentials to finalize.
                    </div>
                    <div>
                      <label className="block text-text-secondary mb-1">Password</label>
                      <input 
                        type="password" 
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full bg-[#05070a] border border-border-color rounded px-3 py-1.5 text-text-primary focus:outline-none focus:border-accent-blue" 
                        placeholder="••••••••"
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={regCompleteLoading}
                      className="bg-accent-blue hover:bg-blue-600 text-white font-semibold py-2.5 rounded mt-2 transition-colors duration-150 cursor-pointer shadow-md w-full"
                    >
                      {regCompleteLoading ? 'Creating Account...' : 'Complete Registration & Continue'}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              <div className="flex justify-between items-center text-[10px] text-text-muted mt-2">
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setCardState('login'); }}
                  className="hover:text-accent-blue transition-colors duration-150"
                >
                  Already have an account? Login
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
