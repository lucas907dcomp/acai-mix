function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-purple-600">AçaiMix PDV</h1>
        <p className="text-gray-500">Ponto de Venda — v0.1.0</p>
        <div className="flex gap-3 justify-center">
          <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm">
            Roxo Profundo
          </span>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm">
            Verde-Menta
          </span>
          <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm">
            Amarelo Quente
          </span>
        </div>
      </div>
    </div>
  )
}

export default App
