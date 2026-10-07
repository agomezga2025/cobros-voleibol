import { useState } from 'react'
import { supabase } from '../supabaseClient'
import '../styles/Login.css'

export default function Register({ onRegisterSuccess, onToggleToLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Validaciones
      if (username.length < 3) {
        throw new Error('Usuario debe tener mín. 3 caracteres')
      }
      if (password.length < 6) {
        throw new Error('Contraseña debe tener mín. 6 caracteres')
      }
      if (password !== confirmPassword) {
        throw new Error('Las contraseñas no coinciden')
      }

      // Generar email interno desde username
      const generatedEmail = `${username.toLowerCase()}@cobros-app.local`

      const { data, error } = await supabase.auth.signUp({
        email: generatedEmail,
        password,
        options: {
          data: {
            username: username,
            name: username
          }
        }
      })

      if (error) throw error

      setSuccess(`✓ Registrado como "${username}". ¡Ya puedes hacer login!`)
      setUsername('')
      setPassword('')
      setConfirmPassword('')

      // Cambiar a login después de 2 segundos
      setTimeout(() => {
        if (onToggleToLogin) onToggleToLogin()
      }, 2000)
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

        <h1 className="login-title">Crear Cuenta<br/>Entrenador</h1>

        <form onSubmit={handleRegister} className="login-form">
          <div className="form-group">
            <label className="form-label">USUARIO</label>
            <input
              type="text"
              placeholder="tu_usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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

          <div className="form-group">
            <label className="form-label">CONFIRMAR CONTRASEÑA</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button
            type="submit"
            className="btn-acceder"
            disabled={loading}
          >
            {loading ? 'Registrando...' : 'REGISTRARSE'}
          </button>
        </form>

        <div className="login-footer-text">
          <button
            onClick={onToggleToLogin}
            className="toggle-auth-link"
          >
            ¿Ya tienes cuenta? Entra aquí
          </button>
          <p className="copyright">© 2026 Voleibol Coaching</p>
        </div>
      </div>
    </div>
  )
}
