export default function Button({ children, ...props }) {
  return (
    <button
      className="w-full bg-black text-white rounded-lg py-2.5 font-medium hover:bg-gray-800 disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  )
}
