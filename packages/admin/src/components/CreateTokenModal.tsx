import { useState } from 'react'
import { X, Copy, CheckCircle, Key } from 'lucide-react'

interface CreateTokenModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: {
    fullName: string
    expiresAt: number
    maxUses: number
  }) => Promise<string | null>
}

export function CreateTokenModal({ isOpen, onClose, onCreate }: CreateTokenModalProps) {
  const [fullName, setFullName] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [expiryTime, setExpiryTime] = useState('')
  const [maxUses, setMaxUses] = useState(1)
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expiryDate || !expiryTime) return

    setLoading(true)
    const date = new Date(`${expiryDate}T${expiryTime}`)
    const expiresAt = date.getTime()

    const token = await onCreate({
      fullName,
      expiresAt,
      maxUses,
    })

    if (token) {
      setGeneratedToken(token)
    }
    setLoading(false)
  }

  const copyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    setFullName('')
    setExpiryDate('')
    setExpiryTime('')
    setMaxUses(1)
    setGeneratedToken(null)
    setCopied(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose}></div>

        <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full border border-gray-200">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h3 className="text-base font-semibold text-black flex items-center">
              <Key className="w-4 h-4 mr-2 text-black" strokeWidth={2} />
              New License Token
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-900 transition-colors p-1 hover:bg-gray-100 rounded-md"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          {generatedToken ? (
            <div className="p-5">
              <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-black rounded-full mb-3">
                  <CheckCircle className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <h4 className="text-base font-semibold text-black mb-1">Token Created</h4>
                <p className="text-gray-500 text-xs">Share this token with the user</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
                <div className="flex items-center justify-between gap-3">
                  <code className="font-mono text-sm text-black tracking-tight truncate">{generatedToken}</code>
                  <button
                    onClick={copyToken}
                    className="text-gray-500 hover:text-black transition-colors p-1.5 hover:bg-gray-200 rounded-md flex-shrink-0"
                  >
                    {copied ? (
                      <CheckCircle className="w-4 h-4 text-green-600" strokeWidth={2} />
                    ) : (
                      <Copy className="w-4 h-4" strokeWidth={2} />
                    )}
                  </button>
                </div>
              </div>

              <button onClick={handleClose} className="btn-primary w-full text-sm py-2">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
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

              <p className="text-xs text-gray-400">
                User ID will be auto-generated on the server
              </p>

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
                      Creating...
                    </span>
                  ) : (
                    'Create Token'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
