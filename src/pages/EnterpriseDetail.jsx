import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft, Building2, Phone, Mail, MapPin, User, Calendar,
  Plus, X, CheckCircle2, Clock, MessageSquare, Edit3, Trash2, ArrowUpRight, Repeat
} from 'lucide-react'
import {
  ACTION_TYPES, CHANNELS, MATURITIES, RESULTS,
  STATUS_COLORS, MATURITY_COLORS, RESULT_COLORS,
  formatDate, formatDateTime, DEPARTMENTS
} from '../utils/constants'
import { fetchAll } from '../utils/dataHelpers'
import { logActivity, ACTIVITY_TYPES as LOG_TYPES } from '../utils/activityLog'

export default function EnterpriseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, isDirection } = useAuth()
  const [enterprise, setEnterprise] = useState(null)
  const [actions, setActions] = useState([])
  const [sectors, setSectors] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddAction, setShowAddAction] = useState(false)
  const [showEditEnterprise, setShowEditEnterprise] = useState(false)
  const [converting, setConverting] = useState(false)
  const [showReclasser, setShowReclasser] = useState(false)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setLoading(true)
    const [entRes, actData, secData, profData] = await Promise.all([
      supabase.from('enterprises').select('*').eq('id', id).single(),
      fetchAll('actions', { eq: { column: 'enterprise_id', value: id }, order: { column: 'performed_at', ascending: false } }),
      fetchAll('sectors'),
      fetchAll('profiles'),
    ])
    setEnterprise(entRes.data)
    setActions(actData)
    setSectors(secData)
    setProfiles(profData)
    setLoading(false)
  }

  async function handleConvert() {
    if (!window.confirm('Confirmer la conversion de ce prospect en client ?')) return
    setConverting(true)
    await supabase.from('enterprises').update({
      status: 'client',
      converted_at: new Date().toISOString(),
      converted_by: profile.id,
    }).eq('id', id)
    await logActivity({
      type: LOG_TYPES.ENTERPRISE_CONVERTED,
      userId: profile.id,
      targetType: 'enterprise',
      targetId: id,
      targetName: enterprise.name,
    })
    await loadData()
    setConverting(false)
  }

  async function handleDelete() {
    if (!window.confirm('Supprimer cette entreprise et tout son historique ? Cette action est irréversible.')) return
    await logActivity({
      type: LOG_TYPES.ENTERPRISE_DELETED,
      userId: profile.id,
      targetType: 'enterprise',
      targetId: id,
      targetName: enterprise.name,
    })
    await supabase.from('enterprises').delete().eq('id', id)
    navigate('/entreprises')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-germa-700 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!enterprise) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Entreprise introuvable</p>
        <button onClick={() => navigate('/entreprises')} className="btn-primary mt-4">Retour</button>
      </div>
    )
  }

  const sector = sectors.find(s => s.id === enterprise.sector_id)
  const creator = profiles.find(p => p.id === enterprise.created_by)
  const converter = enterprise.converted_by ? profiles.find(p => p.id === enterprise.converted_by) : null
  const statusColor = STATUS_COLORS[enterprise.status]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate(enterprise?.status === 'client' ? '/clients' : '/prospects')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-germa-700 transition-colors"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      {/* Enterprise header card */}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-germa-50 flex items-center justify-center flex-shrink-0">
              <Building2 size={22} className="text-germa-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display font-bold text-xl sm:text-2xl text-gray-900">{enterprise.name}</h1>
                <span className={`badge ${statusColor.bg} ${statusColor.text}`}>{statusColor.label}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                {sector && <span className="flex items-center gap-1"><Building2 size={13} />{sector.name}</span>}
                {enterprise.department && <span className="flex items-center gap-1"><MapPin size={13} />{enterprise.department}{enterprise.city ? ` — ${enterprise.city}` : ''}</span>}
                {enterprise.interlocuteur && <span className="flex items-center gap-1"><User size={13} />{enterprise.interlocuteur}</span>}
                {enterprise.contact_name && <span className="flex items-center gap-1"><User size={13} />{enterprise.contact_name}</span>}
                {enterprise.phone && <span className="flex items-center gap-1"><Phone size={13} />{enterprise.phone}</span>}
                {enterprise.email && <span className="flex items-center gap-1"><Mail size={13} />{enterprise.email}</span>}
                {enterprise.a_relancer && <span className="badge bg-amber-50 text-amber-700">🔔 À relancer</span>}
              </div>
              {enterprise.communaute_communes && <p className="text-xs text-gray-400 mt-1">Communauté de communes : {enterprise.communaute_communes}</p>}
              {enterprise.notes && <p className="text-sm text-gray-600 mt-2 bg-gray-50 px-3 py-2 rounded-lg">{enterprise.notes}</p>}
              <div className="text-xs text-gray-400 mt-2">
                Créé le {formatDate(enterprise.created_at)} par {creator?.full_name || '—'}
                {converter && <span> • Converti le {formatDate(enterprise.converted_at)} par {converter.full_name}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:flex-col">
            {enterprise.status === 'prospect' && (
              <button
                onClick={handleConvert}
                disabled={converting}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <CheckCircle2 size={16} />
                <span>{converting ? 'Conversion…' : 'Convertir en client'}</span>
              </button>
            )}
            <button
              onClick={async () => {
                const newVal = !enterprise.a_relancer
                await supabase.from('enterprises').update({ a_relancer: newVal }).eq('id', id)
                loadData()
              }}
              className={`btn-secondary flex items-center gap-2 text-sm ${enterprise.a_relancer ? '!border-amber-300 !text-amber-700' : ''}`}
            >
              {enterprise.a_relancer ? '🔕 Retirer relance' : '🔔 À relancer'}
            </button>
            <button onClick={() => setShowEditEnterprise(true)} className="btn-secondary flex items-center gap-2 text-sm">
              <Edit3 size={14} /> Modifier
            </button>
            {isDirection && (
              <>
                <div className="relative">
                  <button onClick={() => setShowReclasser(!showReclasser)} className="btn-secondary flex items-center gap-2 text-sm">
                    <Repeat size={14} /> Reclasser
                  </button>
                  {showReclasser && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 min-w-[140px]">
                      {['prospect', 'client'].filter(s => s !== enterprise.status).map(s => (
                        <button key={s} onClick={async () => {
                          await supabase.from('enterprises').update({ status: s, converted_at: null, converted_by: null }).eq('id', id)
                          await logActivity({ type: LOG_TYPES.ENTERPRISE_UPDATED, userId: profile.id, targetType: 'enterprise', targetId: id, targetName: enterprise.name, details: `Reclassé en ${s}` })
                          setShowReclasser(false)
                          loadData()
                        }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 capitalize">
                          {s === 'prospect' ? 'Prospect' : 'Client'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={handleDelete} className="btn-danger flex items-center gap-2 text-sm">
                  <Trash2 size={14} /> Supprimer
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions section */}
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg text-gray-900">
          Historique des actions ({actions.length})
        </h2>
        <button onClick={() => setShowAddAction(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Nouvelle action
        </button>
      </div>

      {/* Actions timeline */}
      {actions.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Aucune action enregistrée</p>
          <button onClick={() => setShowAddAction(true)} className="btn-primary mt-4 text-sm">Ajouter la première action</button>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action, i) => {
            const performer = profiles.find(p => p.id === action.performed_by)
            const resultColor = RESULT_COLORS[action.result] || {}
            const matColor = action.maturity ? MATURITY_COLORS[action.maturity] : null

            return (
              <div key={action.id} className="card px-4 py-3 sm:px-5 sm:py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">{action.action_type}</span>
                      <span className="text-xs text-gray-400">via {action.channel}</span>
                      <span className={`badge ${resultColor.bg} ${resultColor.text}`}>{action.result}</span>
                      {matColor && (
                        <span className={`badge ${matColor.bg} ${matColor.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${matColor.dot} mr-1`} />
                          {action.maturity}
                        </span>
                      )}
                    </div>
                    {action.comments && <p className="text-sm text-gray-600 mt-1.5">{action.comments}</p>}
                    {action.contact && <p className="text-xs text-blue-600 mt-1 italic">📌 {action.contact}</p>}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 mt-2">
                      <span className="flex items-center gap-1"><Calendar size={11} />{formatDateTime(action.performed_at)}</span>
                      <span className="flex items-center gap-1"><User size={11} />{performer?.full_name || '—'}</span>
                      {action.need_identified && <span>Besoin : {action.need_type || 'Oui'}</span>}
                      {action.next_action && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />Relance : {action.next_action} le {formatDate(action.next_action_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  {isDirection && (
                    <button
                      onClick={async () => {
                        if (!window.confirm('Supprimer cette action ?')) return
                        await logActivity({
                          type: LOG_TYPES.ACTION_DELETED,
                          userId: profile.id,
                          targetType: 'action',
                          targetId: action.id,
                          targetName: enterprise.name,
                          details: `${action.action_type} via ${action.channel}`,
                        })
                        await supabase.from('actions').delete().eq('id', action.id)
                        loadData()
                      }}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Action Modal */}
      {showAddAction && (
        <AddActionModal
          enterpriseId={id}
          enterpriseName={enterprise.name}
          onClose={() => setShowAddAction(false)}
          onCreated={() => { setShowAddAction(false); loadData() }}
        />
      )}

      {/* Edit Enterprise Modal */}
      {showEditEnterprise && (
        <EditEnterpriseModal
          enterprise={enterprise}
          sectors={sectors}
          onClose={() => setShowEditEnterprise(false)}
          onSaved={() => { setShowEditEnterprise(false); loadData() }}
        />
      )}
    </div>
  )
}

function AddActionModal({ enterpriseId, enterpriseName, onClose, onCreated }) {
  const { profile } = useAuth()
  const [form, setForm] = useState({
    action_type: 'Physique',
    channel: 'Physique',
    is_new_prospect: false,
    need_identified: false,
    need_type: '',
    maturity: '',
    result: 'À relancer',
    next_action: '',
    next_action_date: '',
    comments: '',
    contact: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    // Sync channel with action_type
    if (field === 'action_type') setForm(f => ({ ...f, [field]: value, channel: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data: newAction, error: err } = await supabase.from('actions').insert({
      enterprise_id: enterpriseId,
      performed_by: profile.id,
      action_type: form.action_type,
      channel: form.channel,
      is_new_prospect: form.is_new_prospect,
      need_identified: form.need_identified,
      need_type: form.need_type || null,
      maturity: form.maturity || null,
      result: form.result,
      next_action: form.next_action || null,
      next_action_date: form.next_action_date || null,
      comments: form.comments || null,
      contact: form.contact || null,
    }).select().single()
    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      await logActivity({
        type: LOG_TYPES.ACTION_CREATED,
        userId: profile.id,
        targetType: 'enterprise',
        targetId: enterpriseId,
        targetName: enterpriseName,
        details: `${form.action_type} — ${form.result}`,
      })
      onCreated()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-lg">Nouvelle action</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type d'échange *</label>
              <select value={form.action_type} onChange={e => update('action_type', e.target.value)} className="select-field">
                {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maturité</label>
              <select value={form.maturity} onChange={e => update('maturity', e.target.value)} className="select-field">
                <option value="">— Non défini —</option>
                {MATURITIES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Résultat *</label>
            <select value={form.result} onChange={e => update('result', e.target.value)} className="select-field">
              {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_new_prospect} onChange={e => update('is_new_prospect', e.target.checked)} className="rounded border-gray-300 text-germa-600" />
              Nouveau prospect
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.need_identified} onChange={e => update('need_identified', e.target.checked)} className="rounded border-gray-300 text-germa-600" />
              Besoin identifié
            </label>
          </div>

          {form.need_identified && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de besoin</label>
              <input value={form.need_type} onChange={e => update('need_type', e.target.value)} className="input-field" placeholder="Ex: Intérim renfort" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prochaine action</label>
              <input value={form.next_action} onChange={e => update('next_action', e.target.value)} className="input-field" placeholder="Ex: Relance téléphonique" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date prochaine action</label>
              <input type="date" value={form.next_action_date} onChange={e => update('next_action_date', e.target.value)} className="input-field" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commentaires</label>
            <textarea value={form.comments} onChange={e => update('comments', e.target.value)} className="input-field" rows={3} placeholder="Notes libres…" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suivi / Contact</label>
            <input value={form.contact} onChange={e => update('contact', e.target.value)} className="input-field" placeholder="Ex: mail envoyé le 15/04, à rappeler vendredi…" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus size={16} />}
              <span>Enregistrer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditEnterpriseModal({ enterprise, sectors, onClose, onSaved }) {
  const { profile } = useAuth()
  const [form, setForm] = useState({
    name: enterprise.name || '',
    sector_id: enterprise.sector_id || '',
    city: enterprise.city || '',
    department: enterprise.department || '',
    phone: enterprise.phone || '',
    email: enterprise.email || '',
    contact_name: enterprise.contact_name || '',
    interlocuteur: enterprise.interlocuteur || '',
    communaute_communes: enterprise.communaute_communes || '',
    a_relancer: enterprise.a_relancer || false,
    notes: enterprise.notes || '',
  })
  const [saving, setSaving] = useState(false)

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // Check if current sector is Mairie
  const currentSector = sectors.find(s => s.id === form.sector_id)
  const isMairie = currentSector?.name === 'Mairie'

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('enterprises').update({
      name: form.name.trim(),
      sector_id: form.sector_id || null,
      city: form.city.trim() || null,
      department: form.department || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      contact_name: form.contact_name.trim() || null,
      interlocuteur: form.interlocuteur.trim() || null,
      communaute_communes: form.communaute_communes.trim() || null,
      a_relancer: form.a_relancer,
      notes: form.notes.trim() || null,
    }).eq('id', enterprise.id)
    await logActivity({
      type: LOG_TYPES.ENTERPRISE_UPDATED,
      userId: profile.id,
      targetType: 'enterprise',
      targetId: enterprise.id,
      targetName: form.name.trim(),
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-lg">Modifier l'entreprise</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input value={form.name} onChange={e => update('name', e.target.value)} className="input-field" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secteur</label>
              <select value={form.sector_id} onChange={e => update('sector_id', e.target.value)} className="select-field">
                <option value="">—</option>
                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
              <select value={form.department} onChange={e => update('department', e.target.value)} className="select-field">
                <option value="">—</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
            <input value={form.city} onChange={e => update('city', e.target.value)} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Interlocuteur et fonction</label>
            <input value={form.interlocuteur} onChange={e => update('interlocuteur', e.target.value)} className="input-field" placeholder="Ex: M. Dupont, DRH" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
            <input value={form.contact_name} onChange={e => update('contact_name', e.target.value)} className="input-field" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input value={form.phone} onChange={e => update('phone', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input value={form.email} onChange={e => update('email', e.target.value)} className="input-field" /></div>
          </div>
          {isMairie && (
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Communauté de communes</label>
              <input value={form.communaute_communes} onChange={e => update('communaute_communes', e.target.value)} className="input-field" /></div>
          )}
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)} className="input-field" rows={2} /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.a_relancer} onChange={e => update('a_relancer', e.target.checked)} className="rounded border-gray-300 text-germa-600" />
            🔔 À relancer
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
