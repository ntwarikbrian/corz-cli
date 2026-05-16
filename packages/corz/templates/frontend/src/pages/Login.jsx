import { useState } from "react"
import { login as loginApi } from "../api/auth"

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const data = await loginApi(username, password)
      onLogin(data.token)
    } catch (err) {
      setError(err.response?.data?.error || "Invalid username or password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f0eb] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-[22px] sm:text-2xl font-bold text-[#1e3a5f] tracking-tight">{{projectName}}</h1>
          <p className="text-gray-500 text-sm sm:text-[15px] mt-1">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-200 bg-gray-50/50 rounded-xl px-4 py-[10px] sm:py-2.5 text-sm sm:text-[15px] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] focus:bg-white transition-all duration-200 placeholder:text-gray-400"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] sm:text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 bg-gray-50/50 rounded-xl px-4 py-[10px] sm:py-2.5 text-sm sm:text-[15px] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] focus:bg-white transition-all duration-200 placeholder:text-gray-400"
                placeholder="Enter your password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 sm:px-4">
                <p className="text-red-500 text-[13px] sm:text-sm text-center font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e3a5f] text-white rounded-xl py-[10px] sm:py-2.5 text-sm sm:text-[15px] font-semibold hover:bg-[#162d4a] active:bg-[#0f2238] disabled:opacity-50 transition-all duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
