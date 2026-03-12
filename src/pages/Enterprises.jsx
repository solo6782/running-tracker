import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Search, Plus, Filter, Building2, X, MapPin, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react'
import { DEPARTMENTS, STATUS_COLORS, MATURITY_COLORS, formatDate } from '../utils/constants'
import { fetchAll } from '../utils/dataHelpers'
import { logActivity, ACTIVITY_TYPES } from '../utils/activityLog'

export default function Enterprises({ filterStatus }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [enterprises, setEnterprises] = useState([])
  const [sectors, setSectors] = useState([])
  const [profiles, setProfiles] = useState([])
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSector, setFilterSector] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterCommercial, setFilterCommercial] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [filterRelance, setFilterRelance] = useState(false)
  const [sortColumn, setSortColumn] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const isProspects = filterStatus === 'prospect'
  const isClients = filterStatus === 'client'
  const title = isClients ? 'Clients' : 'Prospects'

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [entData, secData, profData, actData] = await Promise.all([
      fetchAll('enterprises', { order: { column: 'created_at', ascending: false } }),
      fetchAll('sectors', { order: { column: 'name', ascending: true } }),
      fetchAll('profiles', { filters: { is_active: true } }),
      fetchAll('actions', { order: { column: 'performed_at', ascending: false } }),
    ])
    setEnterprises(entData)
    setSectors(secData)
    setProfiles(profData)
    setActions(actData)
    setLoading(false)
  }

  // Latest maturity per enterprise
  const latestMaturity = useMemo(() => {
    const map = {}
    actions.forEach(a => {
      if (a.maturity && (!map[a.enterprise_id] || new Date(a.performed_at) > new Date(map[a.enterprise_id].performed_at))) {
        map[a.enterprise_id] = a
      }
    })
    return map
  }, [actions])

  // Action count per enterprise
  const actionCounts = useMemo(() => {
    const map = {}
    actions.forEach(a => { map[a.enterprise_id] = (map[a.enterprise_id] || 0) + 1 })
    return map
  }, [actions])

  // Last action date per enterprise
  const lastActionDate = useMemo(() => {
    const map = {}
    actions.forEach(a => {
      if (!map[a.enterprise_id] || new Date(a.performed_at) > new Date(map[a.enterprise_id])) {
        map[a.enterprise_id] = a.performed_at
      }
    })
    return map
  }, [actions])

  // Filter
  const filtered = useMemo(() => {
    return enterprises.filter(e => {
      if (filterStatus && e.status !== filterStatus) return false
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterSector && e.sector_id !== filterSector) return false
      if (filterDept && e.department !== filterDept) return false
      if (filterCommercial && e.created_by !== filterCommercial) return false
      if (filterRelance && !e.a_relancer) return false
      return true
    })
  }, [enterprises, search, filterStatus, filterSector, filterDept, filterCommercial, filterRelance])

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let va, vb
      switch (sortColumn) {
        case 'name':
          va = a.name.toLowerCase(); vb = b.name.toLowerCase()
          break
        case 'sector':
          va = sectors.find(s => s.id === a.sector_id)?.name?.toLowerCase() || ''
          vb = sectors.find(s => s.id === b.sector_id)?.name?.toLowerCase() || ''
          break
        case 'department':
          va = a.department || ''; vb = b.department || ''
          break
        case 'actions':
          va = actionCounts[a.id] || 0; vb = actionCounts[b.id] || 0
          break
        case 'maturity':
          const matOrder = { 'Chaud': 3, 'Tiède': 2, 'Froid': 1 }
          va = matOrder[latestMaturity[a.id]?.maturity] || 0
          vb = matOrder[latestMaturity[b.id]?.maturity] || 0
          break
        case 'lastAction':
          va = lastActionDate[a.id] || ''; vb = lastActionDate[b.id] || ''
          break
        case 'commercial':
          va = profiles.find(p => p.id === a.created_by)?.full_name?.toLowerCase() || ''
          vb = profiles.find(p => p.id === b.created_by)?.full_name?.toLowerCase() || ''
          break
        case 'created_at':
          va = a.created_at; vb = b.created_at
          break
        default:
          va = a.name.toLowerCase(); vb = b.name.toLowerCase()
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [filtered, sortColumn, sortDir, sectors, actionCounts, latestMaturity, lastActionDate, profiles])

  function toggleSort(col) {
    if (sortColumn === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(col)
      setSortDir('asc')
    }
  }

  function SortIcon({ col }) {
    if (sortColumn !== col) return <ArrowUpDown size={12} className="text-gray-300" />
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-germa-600" /> : <ArrowDown size={12} className="text-germa-600" />
  }

  const activeFilters = [filterSector, filterDept, filterCommercial].filter(Boolean).length

  function clearFilters() {
    setFilterSector('')
    setFilterDept('')
    setFilterCommercial('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-germa-700 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">{title}</h1>
          <p className="text-gray-500 text-sm">{sorted.length} {title.toLowerCase()}</p>
        </div>
        {isProspects && (
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 self-start">
            <Plus size={18} />
            <span>Nouveau prospect</span>
          </button>
        )}
        {isClients && (
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 self-start">
            <Plus size={18} />
            <span>Nouveau client</span>
          </button>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <button
          onClick={() => setFilterRelance(!filterRelance)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            filterRelance
              ? 'bg-amber-500 text-white shadow-md'
              : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          🔔 À relancer
          {filterRelance && <span className="text-xs">({enterprises.filter(e => e.a_relancer && (!filterStatus || e.status === filterStatus)).length})</span>}
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary flex items-center gap-2 ${activeFilters > 0 ? '!border-germa-500 !text-germa-700' : ''}`}
        >
          <Filter size={16} />
          <span>Filtres</span>
          {activeFilters > 0 && (
            <span className="w-5 h-5 rounded-full bg-germa-700 text-white text-xs flex items-center justify-center">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="card p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Secteur</label>
            <select value={filterSector} onChange={e => setFilterSector(e.target.value)} className="select-field text-sm">
              <option value="">Tous</option>
              {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[100px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Département</label>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="select-field text-sm">
              <option value="">Tous</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Commercial</label>
            <select value={filterCommercial} onChange={e => setFilterCommercial(e.target.value)} className="select-field text-sm">
              <option value="">Tous</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1 pb-2.5">
              <X size={14} /> Effacer
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Aucun {title.toLowerCase()} trouvé</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 w-8">🔔</th>
                  <Th label="Entreprise" col="name" sortColumn={sortColumn} sortDir={sortDir} onSort={toggleSort} />
                  <Th label="Secteur" col="sector" sortColumn={sortColumn} sortDir={sortDir} onSort={toggleSort} />
                  <Th label="Dpt" col="department" sortColumn={sortColumn} sortDir={sortDir} onSort={toggleSort} className="hidden sm:table-cell" />
                  <Th label="Maturité" col="maturity" sortColumn={sortColumn} sortDir={sortDir} onSort={toggleSort} />
                  <Th label="Actions" col="actions" sortColumn={sortColumn} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                  <Th label="Dernière action" col="lastAction" sortColumn={sortColumn} sortDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell" />
                  <Th label="Commercial" col="commercial" sortColumn={sortColumn} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                </tr>
              </thead>
              <tbody>
                {sorted.map(ent => {
                  const sector = sectors.find(s => s.id === ent.sector_id)
                  const creator = profiles.find(p => p.id === ent.created_by)
                  const mat = latestMaturity[ent.id]
                  const matColor = mat ? MATURITY_COLORS[mat.maturity] : null

                  return (
                    <tr
                      key={ent.id}
                      onClick={() => navigate(`/entreprises/${ent.id}`)}
                      className="border-b border-gray-50 hover:bg-germa-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-3 text-center">{ent.a_relancer ? '🔔' : ''}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          {ent.name}
                        </div>
                        {ent.city && <span className="text-xs text-gray-400 block">{ent.city}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{sector?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{ent.department || '—'}</td>
                      <td className="px-4 py-3">
                        {matColor ? (
                          <span className={`badge ${matColor.bg} ${matColor.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${matColor.dot} mr-1.5`} />
                            {mat.maturity}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{actionCounts[ent.id] || 0}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{formatDate(lastActionDate[ent.id])}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{creator?.full_name?.split(' ')[0] || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Enterprise Modal */}
      {showAddModal && (
        <AddEnterpriseModal
          sectors={sectors}
          defaultStatus={filterStatus || 'prospect'}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); loadData() }}
        />
      )}
    </div>
  )
}

function Th({ label, col, sortColumn, sortDir, onSort, className = '' }) {
  const isActive = sortColumn === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-germa-700 select-none ${className}`}
    >
      <div className="flex items-center gap-1.5">
        {label}
        {isActive ? (
          sortDir === 'asc' ? <ArrowUp size={12} className="text-germa-600" /> : <ArrowDown size={12} className="text-germa-600" />
        ) : (
          <ArrowUpDown size={12} className="text-gray-300" />
        )}
      </div>
    </th>
  )
}

function AddEnterpriseModal({ sectors, defaultStatus, onClose, onCreated }) {
  const { profile } = useAuth()
  const [form, setForm] = useState({
    name: '', sector_id: '', city: '', department: '', phone: '', email: '', contact_name: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom est obligatoire'); return }
    setSaving(true)
    setError('')
    const { data: newEnt, error: err } = await supabase.from('enterprises').insert({
      name: form.name.trim(),
      sector_id: form.sector_id || null,
      city: form.city.trim() || null,
      department: form.department || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      contact_name: form.contact_name.trim() || null,
      notes: form.notes.trim() || null,
      status: defaultStatus || 'prospect',
      created_by: profile.id,
    }).select().single()
    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      await logActivity({
        type: ACTIVITY_TYPES.ENTERPRISE_CREATED,
        userId: profile.id,
        targetType: 'enterprise',
        targetId: newEnt?.id,
        targetName: form.name.trim(),
      })
      onCreated()
    }
  }

  const titleLabel = defaultStatus === 'client' ? 'Nouveau client' : 'Nouveau prospect'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-lg">{titleLabel}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise *</label>
            <input value={form.name} onChange={e => update('name', e.target.value)} className="input-field" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secteur</label>
              <select value={form.sector_id} onChange={e => update('sector_id', e.target.value)} className="select-field">
                <option value="">— Choisir —</option>
                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
              <select value={form.department} onChange={e => update('department', e.target.value)} className="select-field">
                <option value="">— Choisir —</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
            <input value={form.city} onChange={e => update('city', e.target.value)} className="input-field" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du contact</label>
            <input value={form.contact_name} onChange={e => update('contact_name', e.target.value)} className="input-field" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input value={form.phone} onChange={e => update('phone', e.target.value)} className="input-field" type="tel" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input value={form.email} onChange={e => update('email', e.target.value)} className="input-field" type="email" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)} className="input-field" rows={2} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus size={16} />}
              <span>Créer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
