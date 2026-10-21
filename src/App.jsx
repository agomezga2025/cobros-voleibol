import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import RegistroCobros from './components/RegistroCobros'
import Historico from './components/Historico'
import Calendario from './components/Calendario'
import BottomNav from './components/FloatingMenu'
import './App.css'
import FloatingMenu from './components/FloatingMenu'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRegister, setIsRegister] = useState(false)

  useEffect(() => {
    // Check if user is logged in on component mount
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user || null)
      } catch (error) {
        console.error('Auth check error:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  if (!user) {
    return isRegister ? (
      <Register
        onRegisterSuccess={() => setIsRegister(false)}
        onToggleToLogin={() => setIsRegister(false)}
      />
    ) : (
      <Login
        onLoginSuccess={(user) => setUser(user)}
        onToggleToRegister={() => setIsRegister(true)}
      />
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/dashboard" element={<Dashboard user={user} />} />
        <Route path="/registrar" element={<RegistroCobros user={user} />} />
        <Route path="/historico" element={<Historico user={user} />} />
        <Route path="/calendario" element={<Calendario user={user} />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <FloatingMenu />
    </Router>
  )
}

export default App
