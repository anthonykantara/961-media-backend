const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Load initial articles (the mock data)
let articles = [
  // Lebanon - English
  {
    id: 'lb-en-1',
    title: "Lebanon's Tech Scene is Booming in 2026",
    status: 'Published',
    author: 'Anthony Rahayel',
    category: 'News',
    date: 'Mar 28, 2026',
    time: '10:30 AM',
    views: '14.2k',
    shares: '420',
    image: 'https://picsum.photos/seed/lb-tech/400/250',
    locationId: 'lb',
    language: 'en'
  },
  {
    id: 'lb-en-2',
    title: '10 Best Rooftop Bars in Beirut This Summer',
    status: 'Published',
    author: 'Sarah Khoury',
    category: 'Lifestyle',
    date: 'Mar 27, 2026',
    time: '02:15 PM',
    views: '18.9k',
    shares: '680',
    image: 'https://picsum.photos/seed/lb-rooftop/400/250',
    locationId: 'lb',
    language: 'en'
  },
  {
    id: 'lb-en-3',
    title: 'The Ultimate Guide to Lebanese Street Food',
    status: 'Published',
    author: 'Anthony Rahayel',
    category: 'Food & Drink',
    date: 'Mar 26, 2026',
    time: '11:00 AM',
    views: '22.4k',
    shares: '940',
    image: 'https://picsum.photos/seed/lb-food/400/250',
    locationId: 'lb',
    language: 'en'
  },
  {
    id: 'lb-en-4',
    title: 'Hidden Gems in the Mountains of Chouf',
    status: 'Published',
    author: 'Jane Smith',
    category: 'Travel',
    date: 'Mar 25, 2026',
    time: '04:45 PM',
    views: '9.1k',
    shares: '310',
    image: 'https://picsum.photos/seed/lb-chouf/400/250',
    locationId: 'lb',
    language: 'en'
  },
  {
    id: 'lb-en-5',
    title: 'Hiking Trails You Need to Explore in the Cedars',
    status: 'Published',
    author: 'John Doe',
    category: 'Things To Do',
    date: 'Mar 24, 2026',
    time: '09:15 AM',
    views: '11.8k',
    shares: '390',
    image: 'https://picsum.photos/seed/lb-cedars/400/250',
    locationId: 'lb',
    language: 'en'
  },
  {
    id: 'lb-en-6',
    title: 'Diaspora Shaping the Future of Lebanon',
    status: 'Published',
    author: 'Anthony Rahayel',
    category: 'Diaspora',
    date: 'Mar 23, 2026',
    time: '01:30 PM',
    views: '15.6k',
    shares: '520',
    image: 'https://picsum.photos/seed/lb-diaspora/400/250',
    locationId: 'lb',
    language: 'en'
  },

  // Lebanon - Arabic
  {
    id: 'lb-ar-1',
    title: 'مبادرات جديدة لدعم المشاريع الناشئة في بيروت',
    status: 'Published',
    author: 'سارة خوري',
    category: 'News',
    date: 'Mar 28, 2026',
    time: '12:00 PM',
    views: '12.0k',
    shares: '310',
    image: 'https://picsum.photos/seed/lb-ar-news/400/250',
    locationId: 'lb',
    language: 'ar'
  },
  {
    id: 'lb-ar-2',
    title: 'أفضل الوجهات الثقافية والفنية في لبنان هذا الموسم',
    status: 'Published',
    author: 'أنطوني رحيل',
    category: 'Lifestyle',
    date: 'Mar 27, 2026',
    time: '03:30 PM',
    views: '8.4k',
    shares: '215',
    image: 'https://picsum.photos/seed/lb-ar-life/400/250',
    locationId: 'lb',
    language: 'ar'
  },
  {
    id: 'lb-ar-3',
    title: 'تراث المطبخ اللبناني: أسرار المونة التقليدية',
    status: 'Published',
    author: 'أنطوني رحيل',
    category: 'Food & Drink',
    date: 'Mar 25, 2026',
    time: '05:00 PM',
    views: '16.7k',
    shares: '640',
    image: 'https://picsum.photos/seed/lb-ar-food/400/250',
    locationId: 'lb',
    language: 'ar'
  },

  // Lebanon - French
  {
    id: 'lb-fr-1',
    title: 'Le renouveau de la scène artistique et culturelle de Beyrouth',
    status: 'Published',
    author: 'Sarah Khoury',
    category: 'Lifestyle',
    date: 'Mar 26, 2026',
    time: '10:15 AM',
    views: '7.8k',
    shares: '190',
    image: 'https://picsum.photos/seed/lb-fr-art/400/250',
    locationId: 'lb',
    language: 'fr'
  },
  {
    id: 'lb-fr-2',
    title: 'Escapades de charme entre mer et montagne à Batroun',
    status: 'Published',
    author: 'Anthony Rahayel',
    category: 'Travel',
    date: 'Mar 24, 2026',
    time: '02:40 PM',
    views: '9.3k',
    shares: '240',
    image: 'https://picsum.photos/seed/lb-fr-travel/400/250',
    locationId: 'lb',
    language: 'fr'
  },

  // Saudi Arabia - Riyadh
  {
    id: 'sa-ryd-ar-1',
    title: 'موسم الرياض يستقطب ملايين الزوار بفعاليات غير مسبوقة',
    status: 'Published',
    author: 'Sarah Khoury',
    category: 'News',
    date: 'Mar 28, 2026',
    time: '01:00 PM',
    views: '28.4k',
    shares: '1.2k',
    image: 'https://picsum.photos/seed/sa-ryd-1/400/250',
    locationId: 'sa-riyadh',
    language: 'ar'
  },
  {
    id: 'sa-ryd-ar-2',
    title: 'دليل المطاعم وتجارب التذوق الراقية في قلب العاصمة',
    status: 'Published',
    author: 'Anthony Rahayel',
    category: 'Lifestyle',
    date: 'Mar 27, 2026',
    time: '07:20 PM',
    views: '19.5k',
    shares: '780',
    image: 'https://picsum.photos/seed/sa-ryd-food/400/250',
    locationId: 'sa-riyadh',
    language: 'ar'
  },
  {
    id: 'sa-ryd-en-1',
    title: 'Riyadh Tech Ecosystem Attracts Global Investments',
    status: 'Published',
    author: 'John Doe',
    category: 'News',
    date: 'Mar 26, 2026',
    time: '11:45 AM',
    views: '13.1k',
    shares: '410',
    image: 'https://picsum.photos/seed/sa-ryd-tech/400/250',
    locationId: 'sa-riyadh',
    language: 'en'
  },

  // UAE - Dubai
  {
    id: 'ae-dxb-en-1',
    title: 'Dubai Unveils Next-Generation AI Infrastructure',
    status: 'Published',
    author: 'John Doe',
    category: 'News',
    date: 'Mar 28, 2026',
    time: '09:00 AM',
    views: '24.1k',
    shares: '890',
    image: 'https://picsum.photos/seed/ae-dxb-1/400/250',
    locationId: 'ae-dubai',
    language: 'en'
  },
  {
    id: 'ae-dxb-en-2',
    title: 'The Essential Guide to Dubai Design Week Highlights',
    status: 'Published',
    author: 'Jane Smith',
    category: 'Lifestyle',
    date: 'Mar 27, 2026',
    time: '04:10 PM',
    views: '17.3k',
    shares: '530',
    image: 'https://picsum.photos/seed/ae-dxb-2/400/250',
    locationId: 'ae-dubai',
    language: 'en'
  },
  {
    id: 'ae-dxb-ar-1',
    title: 'دبي تواصل ريادتها في الاقتصاد الرقمي والسياحة العالمية',
    status: 'Published',
    author: 'سارة خوري',
    category: 'News',
    date: 'Mar 26, 2026',
    time: '02:00 PM',
    views: '15.9k',
    shares: '620',
    image: 'https://picsum.photos/seed/ae-dxb-ar/400/250',
    locationId: 'ae-dubai',
    language: 'ar'
  },

  // UAE - Abu Dhabi
  {
    id: 'ae-auh-en-1',
    title: 'Saadiyat Cultural District: A Global Artistic Landmark',
    status: 'Published',
    author: 'Sarah Khoury',
    category: 'News',
    date: 'Mar 25, 2026',
    time: '03:15 PM',
    views: '11.4k',
    shares: '340',
    image: 'https://picsum.photos/seed/ae-auh-1/400/250',
    locationId: 'ae-abudhabi',
    language: 'en'
  },

  // Slovakia
  {
    id: 'sk-en-1',
    title: 'Bratislava Old Town: Architecture, Cafés, and Culture',
    status: 'Published',
    author: 'Jane Smith',
    category: 'Travel',
    date: 'Mar 27, 2026',
    time: '11:00 AM',
    views: '8.2k',
    shares: '210',
    image: 'https://picsum.photos/seed/sk-brat/400/250',
    locationId: 'sk',
    language: 'en'
  },
  {
    id: 'sk-en-2',
    title: 'Slovakia Tech Startup Ecosystem Growth in Central Europe',
    status: 'Published',
    author: 'John Doe',
    category: 'News',
    date: 'Mar 26, 2026',
    time: '01:45 PM',
    views: '6.9k',
    shares: '180',
    image: 'https://picsum.photos/seed/sk-tech/400/250',
    locationId: 'sk',
    language: 'en'
  },
  {
    id: 'sk-sk-1',
    title: 'Inovácie a technologický pokrok na Slovensku v roku 2026',
    status: 'Published',
    author: 'Sarah Khoury',
    category: 'News',
    date: 'Mar 25, 2026',
    time: '04:30 PM',
    views: '5.4k',
    shares: '140',
    image: 'https://picsum.photos/seed/sk-sk-1/400/250',
    locationId: 'sk',
    language: 'sk'
  },

  // Topic - Tech
  {
    id: 'top-tech-1',
    title: 'Breakthroughs in Decentralized Computing and Edge AI',
    status: 'Published',
    author: 'John Doe',
    category: 'Tech',
    date: 'Mar 28, 2026',
    time: '08:30 AM',
    views: '26.8k',
    shares: '1.4k',
    image: 'https://picsum.photos/seed/top-tech/400/250',
    locationId: 'topic-tech',
    language: 'en'
  },

  // Topic - Business
  {
    id: 'top-biz-1',
    title: 'Middle East Venture Capital Hits Historic Records',
    status: 'Published',
    author: 'Jane Smith',
    category: 'Business',
    date: 'Mar 27, 2026',
    time: '10:00 AM',
    views: '19.2k',
    shares: '810',
    image: 'https://picsum.photos/seed/top-biz/400/250',
    locationId: 'topic-business',
    language: 'en'
  },

  // Topic - Sports
  {
    id: 'top-sprt-1',
    title: 'Championship Finals: Complete Preview and Key Matchups',
    status: 'Published',
    author: 'Sarah Khoury',
    category: 'Sports',
    date: 'Mar 26, 2026',
    time: '06:00 PM',
    views: '17.4k',
    shares: '670',
    image: 'https://picsum.photos/seed/top-sprt/400/250',
    locationId: 'topic-sports',
    language: 'en'
  },

  // Extra items
  ...Array.from({ length: 15 }).map((_, i) => ({
    id: `extra-${i + 1}`,
    title: [
      "Economic Recovery: A Path Forward",
      "Beirut's Art Scene: A Resilient Spirit",
      "Sustainable Tourism in the Bekaa Valley",
      "The Rise of Lebanese Startups",
      "Preserving Cultural Heritage in Byblos"
    ][i % 5] + ` (Vol. ${i + 1})`,
    status: ['Published', 'Draft', 'Scheduled', 'Review'][i % 4],
    author: ['Anthony Rahayel', 'Sarah Khoury', 'John Doe', 'Jane Smith'][i % 4],
    category: ['News', 'Lifestyle', 'Food & Drink', 'Diaspora', 'Travel'][i % 5],
    date: `Mar ${20 - (i % 20)}, 2026`,
    time: `${10 + (i % 12)}:${(i * 7) % 60 < 10 ? '0' : ''}${(i * 7) % 60} AM`,
    views: `${(Math.random() * 15).toFixed(1)}k`,
    shares: `${Math.floor(Math.random() * 500)}`,
    image: `https://picsum.photos/seed/extra-${i}/400/250`,
    locationId: ['lb', 'lb', 'sa-riyadh', 'ae-dubai', 'sk'][i % 5],
    language: ['en', 'ar', 'en', 'en', 'en'][i % 5]
  }))
];

// GET /api/articles
app.get('/api/articles', (req, res) => {
  res.json(articles);
});

// GET /api/articles/:id
app.get('/api/articles/:id', (req, res) => {
  const article = articles.find(a => a.id === req.params.id);
  if (!article) {
    return res.status(404).json({ error: 'Article not found' });
  }
  res.json(article);
});

// POST /api/articles
app.post('/api/articles', (req, res) => {
  const { title, status, category, author, image, date, time, locationId, language } = req.body;
  
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const article = {
    id: req.body.id || Math.random().toString(36).substr(2, 9),
    title: title || '',
    status: status || 'Draft',
    author: author || 'Unknown',
    category: category || 'News',
    date: date || dateStr,
    time: time || timeStr,
    views: req.body.views || '0.0k',
    shares: req.body.shares || '0',
    image: image || 'https://picsum.photos/seed/default/400/250',
    locationId: locationId || 'lb',
    language: language || 'en'
  };

  articles.unshift(article);
  res.status(201).json(article);
});

// PUT /api/articles/:id
app.put('/api/articles/:id', (req, res) => {
  const { id } = req.params;
  const index = articles.findIndex(a => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Article not found' });
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const currentArticle = articles[index];
  const updatedArticle = {
    ...currentArticle,
    ...req.body,
    isEdited: true,
    editDate: dateStr,
    editTime: timeStr
  };

  articles[index] = updatedArticle;
  res.json(updatedArticle);
});

// DELETE /api/articles/:id
app.delete('/api/articles/:id', (req, res) => {
  const { id } = req.params;
  const index = articles.findIndex(a => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Article not found' });
  }

  articles.splice(index, 1);
  res.json({ message: 'Article deleted successfully' });
});

app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
});
