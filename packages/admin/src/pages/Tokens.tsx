import { useState, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { Plus, Filter } from 'lucide-react'
import { Layout } from '../components/Layout'
import { TokenTable, type License } from '../components/TokenTable'
import { CreateTokenModal } from '../components/CreateTokenModal'
import { api } from '../convex/_generated/api'

type StatusFilter = 'all' | 'unused' | 'activated' | 'expired' | 'revoked'

export function Tokens() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const licenses = useQuery(api.licenses.getAllLicenses)
  const createTokenMutation = useMutation(api.licenses.createLicenseToken)
  const [_creating, setCreating] = useState(false)

  const filteredLicenses = useMemo(() => {
    if (!licenses) return undefined
    if (statusFilter === 'all') return licenses
    return licenses.filter((license: License) => license.status === statusFilter)
  }, [licenses, statusFilter])

  const handleCreateToken = async (data: {
    fullName: string
    expiresAt: number
    maxUses: number
  }): Promise<string | null> => {
    setCreating(true)
    try {
      const result = await createTokenMutation({
        fullName: data.fullName,
        expiresAt: data.expiresAt,
        maxUses: data.maxUses,
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to create token')
      }

      return result.token || null
    } catch (error) {
      console.error('Failed to create token:', error)
      alert('Failed to create token: ' + (error instanceof Error ? error.message : 'Unknown error'))
      return null
    } finally {
      setCreating(false)
    }
  }

  return (
    <Layout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black tracking-tight">License Tokens</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage activation tokens for your users</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2 focus:ring-1 focus:ring-black focus:border-black outline-none"
            >
              <option value="all">All Status</option>
              <option value="unused">Unused</option>
              <option value="activated">Activated</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center text-sm"
          >
            <Plus className="w-4 h-4 mr-2" strokeWidth={2} />
            Create Token
          </button>
        </div>
      </div>

      <div className="card p-6">
        <TokenTable licenses={filteredLicenses} loading={licenses === undefined} filterStatus={statusFilter} />
      </div>

      <CreateTokenModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateToken}
      />
    </Layout>
  )
}
