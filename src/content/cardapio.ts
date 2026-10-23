// Cardápio de delivery (protótipo, 22/10/2026). Texto e preço moram aqui,
// separados da página, para editar sem mexer em componente.
//
// Preços dos itens avulsos: cadastro real do AçaiMix (loja 1) em 22/10/2026.
// Copos de açaí: calculados pelo quilo da loja (R$ 59,99/kg). A loja é self
// service, então o preço do copo no delivery ainda precisa ser decidido com o
// dono. Os acompanhamentos são exemplo: confirmar o que a loja tem.

export const marca = {
  nome: 'Açaí Mix',
  logo: '/logos/acai-mix.jpg',
  // Número do delivery com DDI e DDD, só dígitos. Vazio = WhatsApp pede o contato.
  whatsapp: '',
  cores: {
    amarelo: '#F7D417',
    roxo: '#7A1868',
    roxoEscuro: '#4A0E40',
    verde: '#14B892',
    fundo: '#FFFBEA',
    // Tons claros fixos: o Tailwind 3 não aplica /opacidade em cor de variável.
    roxoClaro: '#F5EAF3',
    linha: '#EBDDE8',
    suave: '#7E6579',
  },
}

const PRECO_KG = 59.99
const copo = (gramas: number) => Math.round((gramas / 1000) * PRECO_KG * 100) / 100

export const copos = [
  { id: 'copo-300', nome: 'Copo 300 g', descricao: 'Para matar a vontade', preco: copo(300) },
  { id: 'copo-500', nome: 'Copo 500 g', descricao: 'O mais pedido', preco: copo(500) },
  { id: 'copo-700', nome: 'Copo 700 g', descricao: 'Para dividir (ou não)', preco: copo(700) },
]

export const MAX_ACOMPANHAMENTOS = 4
export const acompanhamentos = [
  'Leite em pó',
  'Leite condensado',
  'Granola',
  'Paçoca',
  'Banana',
  'Morango',
  'Confete',
  'Creme de avelã',
]

export const avulsos = [
  {
    secao: 'Sorvetes Coronado',
    itens: [
      { id: 'cor-pistache-500', nome: 'Coronado Pistache 500 ml', preco: 23 },
      { id: 'cor-coco-500', nome: 'Coronado Coco 500 ml', preco: 20 },
      { id: 'cor-ddl-500', nome: 'Coronado Doce de Leite 500 ml', preco: 20 },
      { id: 'cor-belga-500', nome: 'Coronado Chocolate Belga 500 ml', preco: 20 },
      { id: 'cor-cheesecake-500', nome: 'Coronado Cheesecake de Morango 500 ml', preco: 20 },
    ],
  },
  {
    secao: 'Docinhos',
    itens: [
      { id: 'bolo-pote', nome: 'Bolo no pote', preco: 10 },
      { id: 'pudim', nome: 'Pudim', preco: 7 },
      { id: 'brigadeiro', nome: 'Brigadeiro', preco: 7 },
    ],
  },
  {
    secao: 'Bebidas',
    itens: [
      { id: 'agua', nome: 'Água', preco: 3 },
      { id: 'agua-gas', nome: 'Água com gás', preco: 4 },
      { id: 'refri', nome: 'Refrigerante', preco: 5 },
    ],
  },
]

export const pagamentos = ['Pix', 'Cartão na entrega', 'Dinheiro'] as const
