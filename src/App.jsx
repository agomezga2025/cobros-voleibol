import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import RegistroCobros from './components/RegistroCobros'
import './App.css'


function App() {
  const [user, setUser] = useState(null)
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar si ya hay usuario logueado
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      loadCharges()
    }
  }, [user])

  const loadCharges = async () => {
    try {
      const { data, error } = await supabase
        .from('charges')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (error) throw error
      setCharges(data)
    } catch (err) {
      console.error('Error:', err.message)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) return <div>Cargando...</div>

  if (!user) {
    return <Login onLoginSuccess={setUser} />
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Cobros Voleibol</h1>
        <div>
          <span>{user.email}</span>
          <button onClick={handleLogout} style={{ marginLeft: '20px' }}>
            Logout
          </button>
        </div>
      </div>

      <RegistroCobros user={user} onChargeAdded={loadCharges} />

      <div style={{ maxWidth: '900px', margin: '20px auto' }}>
        <h2>Histórico de Cobros</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#2d5016', color: 'white' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>Fecha</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Categoría</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Monto</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Descripción</th>
            </tr>
          </thead>
          <tbody>
            {charges.map((charge) => (
              <tr key={charge.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '10px' }}>{charge.date}</td>
                <td style={{ padding: '10px' }}>{charge.category}</td>
                <td style={{ padding: '10px' }}>{charge.amount}€</td>
                <td style={{ padding: '10px' }}>{charge.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default App
