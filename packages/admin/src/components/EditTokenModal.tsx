import { useState } from 'react'
import { X, Save } from 'lucide-react'
import type { License } from './TokenTable'

interface EditTokenModalProps {
  isOpen: boolean
  license: License | null
  onClose: () => void
  onSave: (data: {
    id: string
    fullName: string
    status: License['status']
    maxUses: number
    expiresAt: number
  }) => Promise<boolean>
}

const statusOptions: License['status'][] = ['unused', 'activated', 'expired', 'revoked']

export function EditTokenModal({ isOpen, license, onClose, onSave }: EditTokenModalProps) {
  const [fullName, setFullName] = useState('')
  const [status, setStatus] = useState<License['status']>('unused')
  const [expiryDate, setExpiryDate] = useState('')
  const [expiryTime, setExpiryTime] = useState('')
  const [maxUses, setMaxUses] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useState(() => {
    if (license) {
      setFullName(license.fullName || '')
      setStatus(license.status)
      setMaxUses(license.maxUses ?? 1)
      const d = new Date(license.expiresAt)
      setExpiryDate(d.toISOString().slice(0, 10))
      setExpiryTime(d.toISOString().slice(11, 16))
    }
  })

  if (!isOpen || !license) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expiryDate || !expiryTime) return

    setLoading(true)
    setError(null)

    const date = new Date(`${expiryDate}T${expiryTime}`)
    const expiresAt = date.getTime()

    const ok = await onSave({
      id: license._id,
      fullName,
      status,
      maxUses,
      expiresAt,
    })

    if (!ok) {
      setError('Failed to update token')
    }
    setLoading(false)
  }

  const handleClose = () => {
    setError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose}></div>

        <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full border border-gray-200">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h3 className="text-base font-semibold text-black flex items-center">
              <Save className="w-4 h-4 mr-2 text-black" strokeWidth={2} />
              Edit License Token
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-900 transition-colors p-1 hover:bg-gray-100 rounded-md"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Token
              </label>
              <code className="block font-mono text-xs text-black bg-gray-100 px-2 py-1.5 rounded border border-gray-200 truncate">
                {license.token}
              </code>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field py-2"
                placeholder="e.g., John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as License['status'])}
                className="input-field py-2"
                required
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Expiry Date & Time
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="input-field py-2"
                  required
                />
                <input
                  type="time"
                  value={expiryTime}
                  onChange={(e) => setExpiryTime(e.target.value)}
                  className="input-field py-2"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Max Uses
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxUses}
                onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
                className="input-field py-2"
                required
              />
            </div>

            <div className="text-xs text-gray-400 space-y-0.5">
              <p>User ID: <span className="font-mono">{license.userId}</span></p>
              <p>Used: {license.usedCount ?? 0} / {maxUses}</p>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-200">
                {error}
              </p>
            )}

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary flex-1 text-sm py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1 text-sm py-2"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-1.5"></div>
                    Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
