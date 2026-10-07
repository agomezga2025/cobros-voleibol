import { useState } from 'react'
import { supabase } from '../supabaseClient'
import '../styles/Login.css'

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      onLoginSuccess(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-bg">
      <div className="login-container">
        <p className="label-small">GESTOR DE COBROS</p>
        
        <h1 className="login-title">Bienvenido<br/>Entrenador</h1>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label className="form-label">USUARIO</label>
            <input
              type="email"
              placeholder="tu_usuario"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">CONTRASEÑA</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="btn-acceder"
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'ACCEDER'}
          </button>
        </form>

        <a href="#" className="forgot-password">¿Olvidaste tu contraseña?</a>

        <div className="login-footer-text">
          <p>Aplicación para gestionar tus cobros como entrenador de voleibol</p>
          <p className="copyright">© 2026 Voleibol Coaching</p>
        </div>
      </div>
    </div>
  )
}