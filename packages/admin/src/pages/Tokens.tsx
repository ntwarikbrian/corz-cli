import { useState, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { Plus, Filter } from 'lucide-react'
import { Layout } from '../components/Layout'
import { TokenTable, type License } from '../components/TokenTable'
import { CreateTokenModal } from '../components/CreateTokenModal'
import { EditTokenModal } from '../components/EditTokenModal'
import { api } from '../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'

type StatusFilter = 'all' | 'unused' | 'activated' | 'expired' | 'revoked'

export function Tokens() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingLicense, setEditingLicense] = useState<License | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const { sessionToken } = useAuth()
  const [_creating, setCreating] = useState(false)

  const licenses = useQuery(api.licenses.getAllLicenses, sessionToken ? { sessionToken } : "skip")
  const createToken = useMutation(api.licenses.adminCreateToken)
  const updateLicense = useMutation(api.licenses.adminUpdateLicense)
  const deleteLicense = useMutation(api.licenses.adminDeleteLicense)

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
    if (!sessionToken) return null
    setCreating(true)
    try {
      const result = await createToken({ sessionToken, ...data })
      return result.token || null
    } catch (error) {
      console.error('Failed to create token:', error)
      alert('Failed to create token: ' + (error instanceof Error ? error.message : 'Unknown error'))
      return null
    } finally {
      setCreating(false)
    }
  }

  const handleEdit = async (data: {
    id: string
    fullName: string
    status: License['status']
    maxUses: number
    expiresAt: number
  }): Promise<boolean> => {
    if (!sessionToken) return false
    try {
      await updateLicense({ sessionToken, ...data })
      setEditingLicense(null)
      return true
    } catch (error) {
      console.error('Failed to update token:', error)
      alert('Failed to update token: ' + (error instanceof Error ? error.message : 'Unknown error'))
      return false
    }
  }

  const handleDelete = async (license: License) => {
    if (!sessionToken) return
    if (!window.confirm(`Are you sure you want to delete token "${license.token}"? This action cannot be undone.`)) return

    try {
      await deleteLicense({ sessionToken, id: license._id })
    } catch (error) {
      console.error('Failed to delete token:', error)
      alert('Failed to delete token: ' + (error instanceof Error ? error.message : 'Unknown error'))
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
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-primary flex items-center text-sm"
          >
            <Plus className="w-4 h-4 mr-2" strokeWidth={2} />
            Create Token
          </button>
        </div>
      </div>

      <div className="card p-6">
        <TokenTable
          licenses={filteredLicenses}
          loading={licenses === undefined}
          filterStatus={statusFilter}
          onEdit={setEditingLicense}
          onDelete={handleDelete}
        />
      </div>

      <CreateTokenModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateToken}
      />

      <EditTokenModal
        isOpen={editingLicense !== null}
        license={editingLicense}
        onClose={() => setEditingLicense(null)}
        onSave={handleEdit}
      />
    </Layout>
  )
}
