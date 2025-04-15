/**
 * Initial achievements data to populate Firestore
 * Each achievement has:
 * - id: unique string identifier
 * - name: display name
 * - description: description of how to earn
 * - tier: 1-5 for rarity/difficulty (1: common, 5: legendary)
 * - icon: emoji or code to represent the achievement
 * - category: type of achievement (product, investment, social, etc.)
 */
const achievementsData = [
  {
    id: "first_product",
    name: "First Creation",
    description: "Upload your first product design",
    tier: 1,
    icon: "🏠",
    category: "product",
  },
  {
    id: "product_collector_5",
    name: "Product Designer",
    description: "Upload 5 product designs",
    tier: 2,
    icon: "🏘️",
    category: "product",
  },
  {
    id: "product_collector_10",
    name: "Design Expert",
    description: "Upload 10 product designs",
    tier: 3,
    icon: "🏙️",
    category: "product",
  },
  {
    id: "product_collector_25",
    name: "Master Architect",
    description: "Upload 25 product designs",
    tier: 4,
    icon: "🌆",
    category: "product",
  },
  {
    id: "first_investment",
    name: "Early Investor",
    description: "Make your first investment",
    tier: 1,
    icon: "💰",
    category: "investment",
  },
  {
    id: "investor_3",
    name: "Portfolio Builder",
    description: "Invest in 3 different products",
    tier: 2,
    icon: "📊",
    category: "investment",
  },
  {
    id: "investor_10",
    name: "Venture Capitalist",
    description: "Invest in 10 different products",
    tier: 3,
    icon: "🏦",
    category: "investment",
  },
  {
    id: "first_sale",
    name: "First Sale",
    description: "Sell your first product",
    tier: 1,
    icon: "🛒",
    category: "sales",
  },
  {
    id: "sales_master_5",
    name: "Sales Starter",
    description: "Make 5 sales of your products",
    tier: 2,
    icon: "📈",
    category: "sales",
  },
  {
    id: "sales_master_25",
    name: "Sales Expert",
    description: "Make 25 sales of your products",
    tier: 3,
    icon: "💎",
    category: "sales",
  },
  {
    id: "top_seller",
    name: "Top Seller",
    description: "Have one of your products reach 100 sales",
    tier: 4,
    icon: "🏆",
    category: "sales",
  },
  {
    id: "first_review",
    name: "First Feedback",
    description: "Write your first product review",
    tier: 1,
    icon: "📝",
    category: "social",
  },
  {
    id: "reviewer_5",
    name: "Critic",
    description: "Write 5 product reviews",
    tier: 2,
    icon: "⭐",
    category: "social",
  },
  {
    id: "first_manufacturing_quote",
    name: "Manufacturing Initiate",
    description: "Submit your first manufacturing quote",
    tier: 1,
    icon: "🔧",
    category: "manufacturing",
  },
  {
    id: "quote_master_5",
    name: "Quote Expert",
    description: "Submit 5 manufacturing quotes",
    tier: 2,
    icon: "⚙️",
    category: "manufacturing",
  },
  {
    id: "first_completed_project",
    name: "Project Complete",
    description: "Complete your first manufacturing project",
    tier: 2,
    icon: "✅",
    category: "manufacturing",
  },
  {
    id: "veteran_user",
    name: "Veteran User",
    description: "Be an active member for 3 months",
    tier: 3,
    icon: "🌟",
    category: "loyalty",
  },
];

export default achievementsData;
