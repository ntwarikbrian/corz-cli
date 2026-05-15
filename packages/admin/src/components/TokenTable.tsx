import { format } from 'date-fns'
import { Copy, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { useState } from 'react'

export interface License {
  _id: string
  token: string
  fullName?: string
  userId: string
  status: 'unused' | 'activated' | 'expired' | 'revoked'
  deviceId?: string | null
  maxUses?: number
  usedCount?: number
  expiresAt: number
  activatedAt?: number | null
  createdAt: number
}

interface TokenTableProps {
  licenses: License[] | undefined
  loading?: boolean
  filterStatus?: 'all' | 'unused' | 'activated' | 'expired' | 'revoked'
}

function StatusBadge({ status }: { status: License['status'] }) {
  const styles = {
    unused: 'bg-gray-100 text-gray-700 border border-gray-200',
    activated: 'bg-green-50 text-green-700 border border-green-200',
    expired: 'bg-red-50 text-red-700 border border-red-200',
    revoked: 'bg-orange-50 text-orange-700 border border-orange-200',
  }

  const icons = {
    unused: Clock,
    activated: CheckCircle,
    expired: XCircle,
    revoked: AlertCircle,
  }

  const Icon = icons[status]

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${styles[status]}`}>
      <Icon className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export function TokenTable({ licenses, loading, filterStatus = 'all' }: TokenTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading || !licenses) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
      </div>
    )
  }

  if (licenses.length === 0) {
    const filterText = filterStatus !== 'all' ? ` with status "${filterStatus}"` : ''
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-sm">No tokens found{filterText}. Create your first token to get started.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs font-medium text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left">Token</th>
            <th className="px-4 py-3 text-left">Full Name</th>
            <th className="px-4 py-3 text-left">User ID</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Uses</th>
            <th className="px-4 py-3 text-left">Expires</th>
            <th className="px-4 py-3 text-left">Device</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {licenses.map((license) => (
            <tr
              key={license._id}
              className="hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center space-x-2">
                  <code className="font-mono text-xs text-black bg-gray-100 px-2 py-1 rounded">{license.token}</code>
                  <button
                    onClick={() => copyToClipboard(license.token, license._id)}
                    className="text-gray-400 hover:text-gray-900 transition-colors"
                    title="Copy token"
                  >
                    {copiedId === license._id ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-900">{license.fullName || <span className="text-gray-400">-</span>}</td>
              <td className="px-4 py-3 text-gray-600 font-mono text-xs">{license.userId}</td>
              <td className="px-4 py-3">
                <StatusBadge status={license.status} />
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs">
                {license.usedCount ?? 0} / {license.maxUses ?? 1}
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs">
                {format(license.expiresAt, 'MMM d, yyyy HH:mm')}
              </td>
              <td className="px-4 py-3 text-xs font-mono">
                {license.deviceId ? (
                  <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{license.deviceId.slice(0, 12)}...</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
