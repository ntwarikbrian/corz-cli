import { useState } from "react"
import Login from "./pages/Login"

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"))

  function handleLogin(newToken) {
    localStorage.setItem("token", newToken)
    setToken(newToken)
  }

  function handleLogout() {
    localStorage.removeItem("token")
    setToken(null)
  }

  if (token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome!</h1>
          <p className="text-gray-500 mb-6">You are now signed in.</p>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return <Login onLogin={handleLogin} />
}

export default App
