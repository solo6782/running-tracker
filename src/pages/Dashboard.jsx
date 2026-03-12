import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, AreaChart, Area,
  ComposedChart
} from 'recharts'
import {
  TrendingUp, Building2, Users, Phone, CalendarCheck, UserCheck,
  ArrowRight, Clock, Target, BarChart3, AlertTriangle, Bell, CheckCircle2, XCircle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDate, MATURITY_COLORS, RESULT_COLORS, STATUS_COLORS } from '../utils/constants'
import { fetchAll } from '../utils/dataHelpers'

const COLORS_MAIN = ['#2D6A4F', '#52B788', '#40916C', '#74C69D', '#95D5B2', '#B7E4C7', '#1B4332', '#D8F3DC', '#8ECAE6', '#FFB703']
const PIE_MATURITY = { Froid: '#0ea5e9', Tiède: '#f59e0b', Chaud: '#ef4444' }
const PIE_RESULT = { 'À relancer': '#3b82f6', 'RDV pris': '#22c55e', 'Refus': '#ef4444', 'Sans suite': '#9ca3af', 'Signé': '#10b981' }
const PIE_TYPE = { 'Physique': '#2D6A4F', 'Téléphonique': '#0ea5e9', 'Mail': '#f59e0b', 'Courrier': '#8b5cf6' }

export default function Dashboard() {
  const { profile, isDirection } = useAuth()
  const navigate = useNavigate()
  const [enterprises, setEnterprises] = useState([])
  const [actions, setActions] = useState([])
  const [profiles, setProfiles] = useState([])
  const [sectors, setSectors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [entData, actData, profData, secData] = await Promise.all([
      fetchAll('enterprises'),
      fetchAll('actions', { order: { column: 'performed_at', ascending: false } }),
      fetchAll('profiles', { filters: { is_active: true } }),
      fetchAll('sectors'),
    ])
    setEnterprises(entData)
    setActions(actData)
    setProfiles(profData)
    setSectors(secData)
    setLoading(false)
  }

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    const thisWeekStart = new Date(now)
    thisWeekStart.setDate(now.getDate() - now.getDay() + 1)
    thisWeekStart.setHours(0, 0, 0, 0)

    const totalEnterprises = enterprises.length
    const prospects = enterprises.filter(e => e.status === 'prospect').length
    const clients = enterprises.filter(e => e.status === 'client').length
    const clientsConvertis = enterprises.filter(e => e.status === 'client' && e.converted_at).length
    const aRelancer = enterprises.filter(e => e.a_relancer).length
    const totalActions = actions.length
    const rdvPris = actions.filter(a => a.result === 'RDV pris').length
    const signes = actions.filter(a => a.result === 'Signé').length
    const refus = actions.filter(a => a.result === 'Refus').length
    const tauxRdv = totalActions > 0 ? ((rdvPris / totalActions) * 100).toFixed(1) : 0

    // Actions ce mois / cette semaine
    const actionsCeMois = actions.filter(a => {
      const d = new Date(a.performed_at)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    }).length
    const actionsCetteSemaine = actions.filter(a => new Date(a.performed_at) >= thisWeekStart).length

    // Dernière maturité par entreprise
    const latestMaturity = {}
    actions.forEach(a => {
      if (a.maturity && (!latestMaturity[a.enterprise_id] || new Date(a.performed_at) > new Date(latestMaturity[a.enterprise_id].performed_at))) {
        latestMaturity[a.enterprise_id] = a
      }
    })
    const prospectsChauds = Object.values(latestMaturity).filter(a => a.maturity === 'Chaud').length
    const prospectsTiedes = Object.values(latestMaturity).filter(a => a.maturity === 'Tiède').length
    const prospectsFroids = Object.values(latestMaturity).filter(a => a.maturity === 'Froid').length

    const maturityData = [
      { name: 'Froid', value: prospectsFroids, color: PIE_MATURITY.Froid },
      { name: 'Tiède', value: prospectsTiedes, color: PIE_MATURITY.Tiède },
      { name: 'Chaud', value: prospectsChauds, color: PIE_MATURITY.Chaud },
    ].filter(d => d.value > 0)

    // Résultats des actions (pie)
    const resultCounts = {}
    actions.forEach(a => { if (a.result) resultCounts[a.result] = (resultCounts[a.result] || 0) + 1 })
    const resultData = Object.entries(resultCounts).map(([name, value]) => ({
      name, value, color: PIE_RESULT[name] || '#9ca3af'
    })).sort((a, b) => b.value - a.value)

    // Types d'échange (pie)
    const typeCounts = {}
    actions.forEach(a => { if (a.action_type) typeCounts[a.action_type] = (typeCounts[a.action_type] || 0) + 1 })
    const typeData = Object.entries(typeCounts).map(([name, value]) => ({
      name, value, color: PIE_TYPE[name] || '#9ca3af'
    })).sort((a, b) => b.value - a.value)

    // Par secteur
    const bySector = sectors.map(s => {
      const sEnts = enterprises.filter(e => e.sector_id === s.id)
      return {
        name: s.name.length > 15 ? s.name.substring(0, 14) + '…' : s.name,
        fullName: s.name,
        total: sEnts.length,
        clients: sEnts.filter(e => e.status === 'client').length,
        prospects: sEnts.filter(e => e.status === 'prospect').length,
      }
    }).filter(s => s.total > 0).sort((a, b) => b.total - a.total)

    // Par département
    const dept67 = enterprises.filter(e => e.department === '67')
    const dept68 = enterprises.filter(e => e.department === '68')
    const deptNone = enterprises.filter(e => !e.department)
    const byDept = [
      { name: 'Dép. 67', prospects: dept67.filter(e => e.status === 'prospect').length, clients: dept67.filter(e => e.status === 'client').length },
      { name: 'Dép. 68', prospects: dept68.filter(e => e.status === 'prospect').length, clients: dept68.filter(e => e.status === 'client').length },
      ...(deptNone.length > 0 ? [{ name: 'Non défini', prospects: deptNone.filter(e => e.status === 'prospect').length, clients: deptNone.filter(e => e.status === 'client').length }] : []),
    ]

    // Évolution mensuelle combinée (12 derniers mois)
    const monthlyData = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const month = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      const y = d.getFullYear()
      const m = d.getMonth()
      const mActions = actions.filter(a => {
        const ad = new Date(a.performed_at)
        return ad.getFullYear() === y && ad.getMonth() === m
      })
      const mConversions = enterprises.filter(e => {
        if (!e.converted_at) return false
        const cd = new Date(e.converted_at)
        return cd.getFullYear() === y && cd.getMonth() === m
      }).length
      const mRdv = mActions.filter(a => a.result === 'RDV pris').length
      const tauxParAction = mActions.length > 0 ? parseFloat(((mConversions / mActions.length) * 100).toFixed(1)) : 0
      monthlyData.push({ month, actions: mActions.length, conversions: mConversions, rdv: mRdv, taux: tauxParAction })
    }

    // Taux de conversion annuel
    const years = [...new Set(enterprises.map(e => new Date(e.created_at).getFullYear()))].sort()
    const annualConvRate = years.map(y => {
      const yConversions = enterprises.filter(e => {
        if (!e.converted_at) return false
        return new Date(e.converted_at).getFullYear() === y
      }).length
      const yTotal = enterprises.filter(e => new Date(e.created_at).getFullYear() <= y).length
      const taux = yTotal > 0 ? parseFloat(((yConversions / yTotal) * 100).toFixed(1)) : 0
      return { year: String(y), conversions: yConversions, taux }
    })

    // Évolution cumulative des entreprises par mois
    const cumulData = []
    const sortedEnts = [...enterprises].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const month = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      const countBefore = sortedEnts.filter(e => new Date(e.created_at) <= endOfMonth).length
      cumulData.push({ month, total: countBefore })
    }

    // Par commercial (pour direction)
    const byCommercial = profiles.map(p => {
      const pActions = actions.filter(a => a.performed_by === p.id)
      const pEnterprises = enterprises.filter(e => e.created_by === p.id)
      return {
        name: p.full_name?.split(' ')[0] || p.email,
        actions: pActions.length,
        entreprises: pEnterprises.length,
        clients: pEnterprises.filter(e => e.status === 'client').length,
        rdv: pActions.filter(a => a.result === 'RDV pris').length,
      }
    }).filter(p => p.actions > 0 || p.entreprises > 0).sort((a, b) => b.actions - a.actions)

    // Prochaines relances (actions avec next_action_date)
    const upcomingRelances = actions
      .filter(a => a.next_action_date && a.result === 'À relancer')
      .sort((a, b) => new Date(a.next_action_date) - new Date(b.next_action_date))
      .slice(0, 8)

    // Entreprises à relancer (flag)
    const entreprisesARelancer = enterprises.filter(e => e.a_relancer).slice(0, 8)

    // Dernières actions
    const recentActions = actions.slice(0, 10)

    // Top entreprises par nombre d'actions
    const actionsByEnt = {}
    actions.forEach(a => { actionsByEnt[a.enterprise_id] = (actionsByEnt[a.enterprise_id] || 0) + 1 })
    const topEnterprises = Object.entries(actionsByEnt)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => {
        const ent = enterprises.find(e => e.id === id)
        return { name: ent?.name || '?', count, status: ent?.status }
      })

    return {
      totalEnterprises, prospects, clients, clientsConvertis, aRelancer, totalActions, rdvPris,
      signes, refus, tauxRdv, actionsCeMois, actionsCetteSemaine,
      prospectsChauds, prospectsTiedes, prospectsFroids,
      maturityData, resultData, typeData, bySector, byDept, monthlyData, annualConvRate, cumulData,
      byCommercial, upcomingRelances, entreprisesARelancer, recentActions, topEnterprises,
    }
  }, [enterprises, actions, profiles, sectors])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-germa-700 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl text-gray-900">
          Bonjour {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Vue d'ensemble de la prospection</p>
      </div>

      {/* KPI Cards — ligne 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard icon={Building2} label="Entreprises" value={stats.totalEnterprises} color="germa" />
        <KPICard icon={Target} label="Prospects" value={stats.prospects} color="blue" />
        <KPICard icon={UserCheck} label="Clients" value={stats.clients} sub={`${stats.clientsConvertis} convertis`} color="emerald" />
        <KPICard icon={Bell} label="À relancer" value={stats.aRelancer} color="amber" />
        <KPICard icon={Phone} label="Actions" value={stats.totalActions} sub={`${stats.actionsCeMois} ce mois`} color="purple" />
        <KPICard icon={CalendarCheck} label="RDV pris" value={stats.rdvPris} sub={`${stats.tauxRdv}% taux RDV`} color="rose" />
      </div>

      {/* Charts — ligne 1 : évolution */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Activité + Conversions combiné */}
        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-gray-900 mb-4 text-sm">📈 Activité & Conversions (12 mois)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" fontSize={10} />
                <YAxis yAxisId="left" fontSize={10} />
                <YAxis yAxisId="right" orientation="right" fontSize={10} unit="%" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="left" type="monotone" dataKey="actions" stroke="#2D6A4F" fill="#2D6A4F" fillOpacity={0.1} strokeWidth={2} name="Actions" />
                <Bar yAxisId="left" dataKey="conversions" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} name="Conversions" />
                <Line yAxisId="right" type="monotone" dataKey="taux" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} name="Taux conv./action %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Croissance portefeuille */}
        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-gray-900 mb-4 text-sm">📊 Croissance du portefeuille</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.cumulData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Area type="monotone" dataKey="total" stroke="#2D6A4F" fill="#2D6A4F" fillOpacity={0.2} strokeWidth={2} name="Entreprises" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Conversions annuelles */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-gray-900 mb-4 text-sm">📅 Conversions annuelles</h3>
          {stats.annualConvRate.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.annualConvRate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="year" fontSize={11} />
                  <YAxis yAxisId="left" fontSize={10} />
                  <YAxis yAxisId="right" orientation="right" fontSize={10} unit="%" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="conversions" fill="#2D6A4F" radius={[4, 4, 0, 0]} name="Conversions" />
                  <Line yAxisId="right" type="monotone" dataKey="taux" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Taux %" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Pas de données</div>}
        </div>
      </div>

      {/* Charts — ligne 2 : répartitions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Maturité */}
        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-gray-900 mb-3 text-sm">🌡️ Maturité des prospects</h3>
          {stats.maturityData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.maturityData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false} style={{ fontSize: 11 }}>
                    {stats.maturityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Pas de données</div>}
        </div>

        {/* Résultats */}
        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-gray-900 mb-3 text-sm">🎯 Résultats des actions</h3>
          {stats.resultData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.resultData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false} style={{ fontSize: 10 }}>
                    {stats.resultData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Pas de données</div>}
        </div>

        {/* Types d'échange */}
        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-gray-900 mb-3 text-sm">📞 Types d'échange</h3>
          {stats.typeData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.typeData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false} style={{ fontSize: 11 }}>
                    {stats.typeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Pas de données</div>}
        </div>
      </div>

      {/* Charts — ligne 3 : barres */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Par secteur */}
        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-gray-900 mb-4 text-sm">📂 Entreprises par secteur</h3>
          {stats.bySector.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.bySector} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" fontSize={10} />
                  <YAxis type="category" dataKey="name" fontSize={10} width={100} />
                  <Tooltip formatter={(v, n) => [v, n === 'total' ? 'Total' : n === 'clients' ? 'Clients' : n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="prospects" fill="#3b82f6" stackId="a" name="Prospects" />
                  <Bar dataKey="clients" fill="#22c55e" stackId="a" radius={[0, 4, 4, 0]} name="Clients" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>}
        </div>

        {/* Par département */}
        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-gray-900 mb-4 text-sm">📍 Répartition par département</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byDept}>
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="prospects" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Prospects" />
                <Bar dataKey="clients" fill="#22c55e" radius={[4, 4, 0, 0]} name="Clients" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Actions par commercial (direction only) */}
      {isDirection && stats.byCommercial.length > 0 && (
        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-gray-900 mb-4 text-sm">👥 Performance par utilisateur</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byCommercial} layout="vertical">
                <XAxis type="number" fontSize={10} />
                <YAxis type="category" dataKey="name" fontSize={11} width={90} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="actions" fill="#2D6A4F" name="Actions" radius={[0, 4, 4, 0]} />
                <Bar dataKey="rdv" fill="#22c55e" name="RDV" radius={[0, 4, 4, 0]} />
                <Bar dataKey="entreprises" fill="#3b82f6" name="Entreprises" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bottom section — tables */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Entreprises à relancer */}
        {stats.entreprisesARelancer.length > 0 && (
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-gray-900 text-sm">🔔 Entreprises à relancer</h3>
              <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-lg">{stats.aRelancer} total</span>
            </div>
            <div className="space-y-1.5">
              {stats.entreprisesARelancer.map(ent => {
                const sector = sectors.find(s => s.id === ent.sector_id)
                return (
                  <div key={ent.id} onClick={() => navigate(`/entreprises/${ent.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-50/50 hover:bg-amber-50 cursor-pointer transition-colors">
                    <Bell size={14} className="text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ent.name}</p>
                      <p className="text-xs text-gray-500">{sector?.name || '—'} · {ent.department || '—'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-lg ${ent.status === 'client' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                      {ent.status === 'client' ? 'Client' : 'Prospect'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top entreprises par activité */}
        <div className="card p-4 sm:p-5">
          <h3 className="font-display font-semibold text-gray-900 mb-3 text-sm">🏆 Entreprises les plus suivies</h3>
          <div className="space-y-1.5">
            {stats.topEnterprises.map((ent, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => {
                  const found = enterprises.find(e => e.name === ent.name)
                  if (found) navigate(`/entreprises/${found.id}`)
                }}>
                <span className="text-xs font-bold text-gray-400 w-5 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ent.name}</p>
                </div>
                <span className="text-xs font-semibold text-germa-700 bg-germa-50 px-2 py-0.5 rounded-lg">{ent.count} actions</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activité récente */}
      <div className="card p-4 sm:p-5">
        <h3 className="font-display font-semibold text-gray-900 mb-3 text-sm">🕐 Activité récente</h3>
        {stats.recentActions.length > 0 ? (
          <div className="space-y-1.5">
            {stats.recentActions.map(action => {
              const ent = enterprises.find(e => e.id === action.enterprise_id)
              const performer = profiles.find(p => p.id === action.performed_by)
              const rColor = RESULT_COLORS[action.result] || {}
              return (
                <div key={action.id} onClick={() => ent && navigate(`/entreprises/${ent.id}`)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{ent?.name || '?'}</p>
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{action.action_type}</span>
                      {action.result && <span className={`text-xs px-1.5 py-0.5 rounded ${rColor.bg || 'bg-gray-100'} ${rColor.text || 'text-gray-600'}`}>{action.result}</span>}
                    </div>
                    {action.comments && <p className="text-xs text-gray-500 truncate mt-0.5">{action.comments}</p>}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(action.performed_at)}</span>
                </div>
              )
            })}
          </div>
        ) : <p className="text-gray-400 text-sm text-center py-8">Aucune activité</p>}
      </div>

      {/* Prochaines relances */}
      {stats.upcomingRelances.length > 0 && (
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-gray-900 text-sm">⏰ Prochaines relances planifiées</h3>
          </div>
          <div className="space-y-1.5">
            {stats.upcomingRelances.map(action => {
              const ent = enterprises.find(e => e.id === action.enterprise_id)
              const performer = profiles.find(p => p.id === action.performed_by)
              const isOverdue = new Date(action.next_action_date) < new Date()
              return (
                <div key={action.id} onClick={() => ent && navigate(`/entreprises/${ent.id}`)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${isOverdue ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  <Clock size={14} className={isOverdue ? 'text-red-500' : 'text-gray-400'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ent?.name || '?'}</p>
                    <p className="text-xs text-gray-500">{action.next_action} — {performer?.full_name}</p>
                  </div>
                  <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                    {isOverdue ? '⚠️ ' : ''}{formatDate(action.next_action_date)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function KPICard({ icon: Icon, label, value, sub, color }) {
  const colorMap = {
    germa: 'bg-germa-50 text-germa-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
    rose: 'bg-rose-50 text-rose-700',
  }
  return (
    <div className="card p-3 sm:p-4">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
        <Icon size={16} />
      </div>
      <p className="text-xl sm:text-2xl font-display font-bold text-gray-900 mt-2">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {sub && <p className="text-xs text-germa-600 font-medium mt-0.5">{sub}</p>}
    </div>
  )
}
