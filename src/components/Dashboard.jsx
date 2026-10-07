import React, { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../supabaseClient'
import '../styles/Dashboard.css'

const Dashboard = ({ user }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [chargesData, setChargesData] = useState([])
  const [loading, setLoading] = useState(false)
  const [monthComparison, setMonthComparison] = useState(0)
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  const COLORS = {
    'partido-casa': '#2d5016',
    'partido-fuera': '#4a7c2f',
    'entrenamiento': '#a58a4a',
    'arbitraje': '#d4a574',
    'gasolina': '#8b7355',
    'otros': '#c9b8a3'
  }

  const CATEGORY_LABELS = {
    'partido-casa': 'Costo',
    'partido-fuera': 'Fuera',
    'entrenamiento': 'Entrenamiento',
    'arbitraje': 'Árbitro',
    'gasolina': 'Gasolina',
    'otros': 'Otros'
  }

  useEffect(() => {
    fetchCharges()
  }, [selectedMonth, user])

  const fetchCharges = async () => {
    if (!user) return

    setLoading(true)
    const startDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
    const endDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)

    // Fetch current month data
    const { data: currentData, error: currentError } = await supabase
      .from('charges')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (currentError) {
      console.error('Error fetching charges:', currentError)
      setLoading(false)
      return
    }

    // Fetch previous month data for comparison
    const prevMonthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1)
    const prevMonthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 0)

    const { data: prevData, error: prevError } = await supabase
      .from('charges')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', prevMonthStart.toISOString())
      .lte('created_at', prevMonthEnd.toISOString())

    if (!prevError && prevData) {
      const prevTotal = prevData.reduce((sum, charge) => sum + (charge.amount || 0), 0)
      const currentTotal = currentData.reduce((sum, charge) => sum + (charge.amount || 0), 0)
      setMonthComparison(currentTotal - prevTotal)
    }

    // Group by category
    const grouped = {}
    currentData.forEach(charge => {
      const category = charge.category || 'otros'
      if (!grouped[category]) {
        grouped[category] = { name: CATEGORY_LABELS[category], category: category, value: 0, amount: 0 }
      }
        grouped[category].amount += charge.amount || 0
        grouped[category].value += charge.amount || 0
    })

    setChargesData(Object.values(grouped))
    setLoading(false)
  }

  const handlePrevMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))
  }

  const handleMonthSelect = (offset) => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + offset))
    setShowMonthPicker(false)
  }

  const totalIncome = chargesData.reduce((sum, item) => sum + item.value, 0)
  const monthName = selectedMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
  const userInitials = user?.user_metadata?.name
    ? user.user_metadata.name.split(' ').map(n => n[0]).join('').toUpperCase()
    : 'AG'

  const chartData = chargesData.map(item => ({
    name: item.name,
    value: item.value
  }))

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="month-selector">
          <button className="nav-button" onClick={handlePrevMonth}>←</button>
          <div className="month-dropdown-wrapper">
            <button
              className="month-button"
              onClick={() => setShowMonthPicker(!showMonthPicker)}
            >
              {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
            </button>
            {showMonthPicker && (
              <div className="month-picker-popup">
                <div className="month-grid">
                  {Array.from({ length: 12 }, (_, i) => {
                    const offset = i - selectedMonth.getMonth()
                    const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + offset)
                    return (
                      <button
                        key={i}
                        className={offset === 0 ? 'month-option active' : 'month-option'}
                        onClick={() => handleMonthSelect(offset)}
                      >
                        {date.toLocaleString('es-ES', { month: 'short', year: '2-digit' })}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <button className="nav-button" onClick={handleNextMonth}>→</button>
        </div>
        <div className="user-avatar">{userInitials}</div>
      </div>

      <h1 className="dashboard-title">Dashboard</h1>

      <div className="chart-container">
        {loading ? (
          <div className="loading">Cargando datos...</div>
        ) : chargesData.length > 0 ? (
          <>
            <h3 className="chart-title">Desglone por Categoría</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[chargesData[index].category]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value.toFixed(2)}€`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="chart-center-text">
                <div className="total-income">{totalIncome.toFixed(2)}€</div>
                <div className="total-label">Total mes</div>
              </div>
            </div>

            <div className="month-comparison">
              {monthComparison >= 0 ? '+' : ''}{monthComparison.toFixed(2)}€ vs mes anterior
            </div>

            <div className="legend-custom">
              {chargesData.map((item, idx) => (
                <div key={idx} className="legend-item">
                  <div
                    className="legend-color"
                    style={{
                     backgroundColor: COLORS[item.category]
                    }}
                  ></div>
                  <span className="legend-label">{item.name}</span>
                  <span className="legend-amount">{item.amount.toFixed(2)}€</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="no-data">
            <p>No hay ingresos registrados para este mes</p>
            <p className="no-data-hint">Registra tu primer ingreso para verlo aquí</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
