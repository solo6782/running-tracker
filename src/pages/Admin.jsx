import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fetchAll, insertBatch, deleteAll } from '../utils/dataHelpers'
import { logActivity, ACTIVITY_TYPES, ACTIVITY_LABELS } from '../utils/activityLog'
import {
  Users, Tags, Upload, Download, Database, Plus, X, Trash2,
  UserCheck, UserX, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, FileSpreadsheet
} from 'lucide-react'

export default function Admin() {
  const [tab, setTab] = useState('users')

  const tabs = [
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'sectors', label: 'Secteurs', icon: Tags },
    { id: 'journal', label: 'Journal', icon: FileSpreadsheet },
    { id: 'export', label: 'Export', icon: Download },
    { id: 'backup', label: 'Backup / Restore', icon: Database },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-gray-900">Administration</h1>
        <p className="text-gray-500 text-sm mt-1">Gestion des utilisateurs, secteurs et données.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.id
                ? 'bg-germa-700 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'users' && <UsersTab />}
      {tab === 'sectors' && <SectorsTab />}
      {tab === 'journal' && <JournalTab />}
      {tab === 'export' && <ExportTab />}
      {tab === 'backup' && <BackupTab />}
    </div>
  )
}

// =====================
// USERS TAB
// =====================
function UsersTab() {
  const { profile: myProfile } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { loadProfiles() }, [])

  async function loadProfiles() {
    setLoading(true)
    const data = await fetchAll('profiles', { order: { column: 'created_at', ascending: true } })
    setProfiles(data)
    setLoading(false)
  }

  async function toggleActive(p) {
    await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id)
    await logActivity({
      type: p.is_active ? ACTIVITY_TYPES.USER_DEACTIVATED : ACTIVITY_TYPES.USER_REACTIVATED,
      userId: myProfile?.id,
      targetType: 'user',
      targetId: p.id,
      targetName: p.full_name,
    })
    loadProfiles()
  }

  async function changeRole(profile, newRole) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', profile.id)
    loadProfiles()
  }

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-germa-700 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-semibold text-gray-900">Comptes utilisateurs ({profiles.length})</h2>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Créer un compte
        </button>
      </div>

      <div className="space-y-2">
        {profiles.map(p => (
          <div key={p.id} className={`card px-4 py-3 flex items-center gap-3 ${!p.is_active ? 'opacity-50' : ''}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${p.is_active ? 'bg-germa-100' : 'bg-gray-100'}`}>
              <span className={`font-bold text-xs ${p.is_active ? 'text-germa-700' : 'text-gray-400'}`}>
                {p.full_name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{p.full_name}</p>
              <p className="text-xs text-gray-500">{p.email}</p>
            </div>
            <select
              value={p.role}
              onChange={e => changeRole(p, e.target.value)}
              className="select-field !w-auto text-xs !py-1.5 !px-2"
            >
              <option value="commercial">Commercial</option>
              <option value="direction">Direction</option>
              <option value="autre">Autre</option>
            </select>
            <button
              onClick={() => toggleActive(p)}
              className={`p-1.5 rounded-lg transition-colors ${
                p.is_active
                  ? 'text-germa-600 hover:bg-red-50 hover:text-red-600'
                  : 'text-gray-400 hover:bg-germa-50 hover:text-germa-600'
              }`}
              title={p.is_active ? 'Désactiver' : 'Réactiver'}
            >
              {p.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
            </button>
          </div>
        ))}
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadProfiles() }} />}
    </div>
  )
}

function CreateUserModal({ onClose, onCreated }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('commercial')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    // Use Supabase admin API to create user via edge function or direct signup
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role }
      }
    })

    if (signUpError) {
      setError(signUpError.message)
      setSaving(false)
      return
    }

    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-lg">Créer un compte</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input type="text" value={password} onChange={e => setPassword(e.target.value)} className="input-field" required minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="select-field">
              <option value="commercial">Commercial</option>
              <option value="direction">Direction</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Création…' : 'Créer le compte'}
            </button>
          </div>
          <p className="text-xs text-gray-400">⚠️ Note : la création de compte via signUp nécessite que la confirmation email soit désactivée dans Supabase, ou que vous utilisiez l'API admin.</p>
        </form>
      </div>
    </div>
  )
}

// =====================
// SECTORS TAB
// =====================
function SectorsTab() {
  const { profile } = useAuth()
  const [sectors, setSectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [newSector, setNewSector] = useState('')

  useEffect(() => { loadSectors() }, [])

  async function loadSectors() {
    setLoading(true)
    const data = await fetchAll('sectors', { order: { column: 'name', ascending: true } })
    setSectors(data)
    setLoading(false)
  }

  async function addSector(e) {
    e.preventDefault()
    if (!newSector.trim()) return
    const { data: s } = await supabase.from('sectors').insert({ name: newSector.trim() }).select().single()
    await logActivity({
      type: ACTIVITY_TYPES.SECTOR_CREATED,
      userId: profile?.id,
      targetType: 'sector',
      targetId: s?.id,
      targetName: newSector.trim(),
    })
    setNewSector('')
    loadSectors()
  }

  async function deleteSector(id) {
    if (!window.confirm('Supprimer ce secteur ?')) return
    const sector = sectors.find(s => s.id === id)
    await logActivity({
      type: ACTIVITY_TYPES.SECTOR_DELETED,
      userId: profile?.id,
      targetType: 'sector',
      targetId: id,
      targetName: sector?.name,
    })
    await supabase.from('sectors').delete().eq('id', id)
    loadSectors()
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display font-semibold text-gray-900">Secteurs d'activité</h2>
      <form onSubmit={addSector} className="flex gap-2">
        <input
          value={newSector}
          onChange={e => setNewSector(e.target.value)}
          className="input-field flex-1"
          placeholder="Nouveau secteur…"
        />
        <button type="submit" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Ajouter
        </button>
      </form>
      <div className="space-y-1">
        {sectors.map(s => (
          <div key={s.id} className="card px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm font-medium">{s.name}</span>
            <button onClick={() => deleteSector(s.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// =====================
// IMPORT TAB
// =====================
// =====================
// JOURNAL TAB
// =====================
function JournalTab() {
  const [logs, setLogs] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadLogs() }, [])

  async function loadLogs() {
    setLoading(true)
    const [logData, profData] = await Promise.all([
      fetchAll('activity_log', { order: { column: 'created_at', ascending: false } }),
      fetchAll('profiles'),
    ])
    setLogs(logData)
    setProfiles(profData)
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-germa-700 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-gray-900">Journal d'activité ({logs.length})</h2>
        <button onClick={loadLogs} className="btn-secondary text-sm">Actualiser</button>
      </div>
      {logs.length === 0 ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Aucune activité enregistrée</div>
      ) : (
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
          {logs.map(log => {
            const performer = profiles.find(p => p.id === log.performed_by)
            const label = ACTIVITY_LABELS[log.activity_type] || log.activity_type
            const date = new Date(log.created_at)
            const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            return (
              <div key={log.id} className="card px-4 py-2.5 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-germa-400 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{label}</span>
                    {log.target_name && <span className="text-sm text-germa-700 font-medium">— {log.target_name}</span>}
                  </div>
                  {log.details && <p className="text-xs text-gray-500 mt-0.5">{log.details}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {performer?.full_name || 'Système'} • {dateStr}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// =====================
// EXPORT TAB
// =====================
function ExportTab() {
  const [exporting, setExporting] = useState(false)

  async function exportCSV(table) {
    setExporting(true)
    const data = await fetchAll(table)
    if (data && data.length > 0) {
      const headers = Object.keys(data[0])
      const csv = [
        headers.join(';'),
        ...data.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(';'))
      ].join('\n')
      downloadFile(csv, `germaclients_${table}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
    }
    setExporting(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display font-semibold text-gray-900">Export CSV</h2>
      <p className="text-sm text-gray-500">Exportez les données au format CSV.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {['enterprises', 'actions', 'profiles'].map(table => (
          <button key={table} onClick={() => exportCSV(table)} disabled={exporting} className="btn-secondary flex items-center justify-center gap-2">
            <Download size={16} />
            <span className="capitalize">{table}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// =====================
// BACKUP TAB
// =====================
function BackupTab() {
  const { profile } = useAuth()
  const fileRef = useRef()
  const [status, setStatus] = useState(null)
  const [restoring, setRestoring] = useState(false)

  async function doBackup() {
    setStatus(null)
    const [enterprises, actions, sectors, profiles, activityLogs] = await Promise.all([
      fetchAll('enterprises'),
      fetchAll('actions'),
      fetchAll('sectors'),
      fetchAll('profiles'),
      fetchAll('activity_log'),
    ])
    const backup = {
      version: 1,
      date: new Date().toISOString(),
      app: 'GermaClients',
      data: { enterprises, actions, sectors, profiles, activity_log: activityLogs }
    }
    downloadFile(
      JSON.stringify(backup, null, 2),
      `germaclients_backup_${new Date().toISOString().split('T')[0]}.json`,
      'application/json'
    )
    setStatus({ type: 'success', message: 'Backup téléchargé avec succès.' })
    await logActivity({
      type: ACTIVITY_TYPES.BACKUP_CREATED,
      userId: profile?.id,
      details: `${enterprises.length} entreprises, ${actions.length} actions`,
    })
  }

  async function handleRestore(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!window.confirm('ATTENTION : la restauration va REMPLACER toutes les données actuelles. Continuer ?')) return

    setRestoring(true)
    setStatus(null)

    try {
      const text = await file.text()
      const backup = JSON.parse(text)

      if (backup.app !== 'GermaClients' || !backup.data) {
        setStatus({ type: 'error', message: 'Fichier de backup invalide.' })
        setRestoring(false)
        return
      }

      // Delete existing data (order matters for foreign keys)
      await deleteAll('actions')
      await deleteAll('enterprises')
      await deleteAll('sectors')

      // Restore sectors
      if (backup.data.sectors?.length) {
        await insertBatch('sectors', backup.data.sectors)
      }

      // Restore enterprises
      if (backup.data.enterprises?.length) {
        await insertBatch('enterprises', backup.data.enterprises)
      }

      // Restore actions
      if (backup.data.actions?.length) {
        await insertBatch('actions', backup.data.actions)
      }

      setStatus({ type: 'success', message: `Restauration terminée : ${backup.data.enterprises?.length || 0} entreprises, ${backup.data.actions?.length || 0} actions.` })
      await logActivity({
        type: ACTIVITY_TYPES.RESTORE_COMPLETED,
        userId: profile?.id,
        details: `${backup.data.enterprises?.length || 0} entreprises, ${backup.data.actions?.length || 0} actions restaurées`,
      })
    } catch (err) {
      setStatus({ type: 'error', message: 'Erreur restauration: ' + err.message })
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display font-semibold text-gray-900">Backup & Restauration</h2>
      <p className="text-sm text-gray-500">Sauvegardez ou restaurez l'intégralité de la base de données au format JSON.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <Database size={24} className="text-germa-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Sauvegarder</h3>
          <p className="text-xs text-gray-500 mb-4">Télécharge un fichier JSON contenant toutes les données.</p>
          <button onClick={doBackup} className="btn-primary w-full flex items-center justify-center gap-2">
            <Download size={16} /> Télécharger le backup
          </button>
        </div>

        <div className="card p-5">
          <Upload size={24} className="text-amber-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Restaurer</h3>
          <p className="text-xs text-gray-500 mb-4">Remplace TOUTES les données par celles du fichier.</p>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={restoring}
            className="btn-secondary w-full flex items-center justify-center gap-2 !border-amber-300 !text-amber-700 hover:!bg-amber-50"
          >
            {restoring ? <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" /> : <Upload size={16} />}
            <span>{restoring ? 'Restauration…' : 'Charger un backup'}</span>
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleRestore} className="hidden" />
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          status.type === 'success' ? 'bg-germa-50 text-germa-800' : 'bg-red-50 text-red-700'
        }`}>
          {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {status.message}
        </div>
      )}
    </div>
  )
}

// =====================
// HELPER
// =====================
function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
