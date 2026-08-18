import AssistantIcon from '@mui/icons-material/SupportAgent';
import ImageIcon from '@mui/icons-material/Image';
import VideoIcon from '@mui/icons-material/OndemandVideo';
import CopywritingIcon from '@mui/icons-material/Description';
import SocialIcon from '@mui/icons-material/Share';
import SeoIcon from '@mui/icons-material/TrendingUp';
import CampaignIcon from '@mui/icons-material/Campaign';
import AdsIcon from '@mui/icons-material/AdsClick';
import LeadIcon from '@mui/icons-material/PersonSearch';
import CodingIcon from '@mui/icons-material/Code';
import DataIcon from '@mui/icons-material/BarChart';
import EmailIcon from '@mui/icons-material/MarkEmailRead';
import AnalyticsIcon from '@mui/icons-material/Assessment';
import CompetitorIcon from '@mui/icons-material/CompareArrows';
import BrandIcon from '@mui/icons-material/Palette';
import ChatIcon from '@mui/icons-material/QuestionAnswer';

// Integration icons
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import GmailIcon from '@mui/icons-material/Email';
import RedditIcon from '@mui/icons-material/Reddit';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import SalesforceIcon from '@mui/icons-material/BusinessCenter';
import GoogleSheetsIcon from '@mui/icons-material/GridOn';
import OutlookIcon from '@mui/icons-material/MailOutline';
import GoogleDriveIcon from '@mui/icons-material/Cloud';
import DescriptionIcon from '@mui/icons-material/Description';
import HubIcon from '@mui/icons-material/Hub';
import YouTubeIcon from '@mui/icons-material/YouTube';
import NotionIcon from '@mui/icons-material/NoteAdd';
import { SiTiktok, SiWordpress, SiInstagram } from 'react-icons/si';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import { TbLetterZ } from 'react-icons/tb';


// ============================================================
// SQUAD DEFINITIONS
// ============================================================

export const squads = [
  // --- General ---
  {
    id: 'general_chat',
    teamId: '20',
    group: 'general_group',
    icon: ChatIcon,
    titleKey: 'general_chat',
    descriptionKey: 'general_chat_description',
    estimatedCredits: { min: 1, max: 3 },
    integrations: [],
    sampleUrl: '',
    samplePrompts: [
      'What time is it in Tokyo right now?',
      'Explain the difference between SEO and GEO',
    ],
    stages: [],
    isDirectChat: true, // Signal to ChatStore to use direct LLM call
  },
  {
    id: 'assistant',
    teamId: '2',
    group: 'general_group',
    icon: AssistantIcon,
    titleKey: 'assistant_squad',
    descriptionKey: 'assistant_squad_description',
    estimatedCredits: { min: 5, max: 20 },
    integrations: [
      { icon: GmailIcon, name: 'Gmail' },
      { icon: OutlookIcon, name: 'Outlook' },
      { icon: CalendarTodayIcon, name: 'Calendar' },
    ],
    sampleUrl: '',
    samplePrompts: [
      'Book a 30-minute meeting with john@example.com for next Tuesday at 2pm',
      'Summarize the latest AI marketing trends from the past week',
    ],
    stages: ['Research', 'Draft', 'Verify', 'Send'],
  },

  // --- Content Creation ---
  {
    id: 'image',
    teamId: '4',
    group: 'content',
    icon: ImageIcon,
    titleKey: 'image_creator_squad',
    descriptionKey: 'image_creator_squad_description',
    estimatedCredits: { min: 100, max: 250 },
    integrations: [
      { icon: GoogleDriveIcon, name: 'Google Drive' },
    ],
    sampleUrl: 'https://blog.promarkia.com/wp-content/uploads/2025/07/1205a24e-1fb3-4e91-b298-399380524d9a.png',
    samplePrompts: [
      'Generate a 16:9 hero image for a blog post about AI in healthcare',
      'Create a minimalist logo for a fintech startup called "PayFlow"',
    ],
    stages: ['Plan', 'Generate', 'Verify', 'Deliver'],
  },
  {
    id: 'video',
    teamId: '5',
    group: 'content',
    icon: VideoIcon,
    titleKey: 'video_squad',
    descriptionKey: 'video_squad_description',
    estimatedCredits: { min: 6400, max: 12000 },
    integrations: [
      { icon: YouTubeIcon, name: 'YouTube' },
      { icon: SiTiktok, name: 'TikTok' },
    ],
    sampleUrl: 'https://blog.promarkia.com/wp-content/uploads/2026/01/697970e524e58.mp4',
    samplePrompts: [
      'Create a 10-second video of a coffee shop in Paris and upload it to YouTube',
      'Generate a product demo video for a SaaS dashboard with a voiceover',
    ],
    stages: ['Plan', 'Create', 'Verify', 'Deliver'],
  },
  {
    id: 'copywriting',
    teamId: '7',
    group: 'content',
    icon: CopywritingIcon,
    titleKey: 'copywriting_squad',
    descriptionKey: 'copywriting_squad_description',
    estimatedCredits: { min: 10, max: 40 },
    integrations: [
      { icon: DescriptionIcon, name: 'Google Docs' },
      { icon: NotionIcon, name: 'Notion' },
      { icon: SiWordpress, name: 'WordPress' },
    ],
    sampleUrl: 'https://blog.promarkia.com/general/full-funnel-ai-marketing-for-smbs-safer-automation-in-30-days/',
    samplePrompts: [
      'Write an SEO-optimized blog post about AI marketing automation and publish it to WordPress',
      'Create a 2000-word article about remote work trends in French and save to Google Docs',
    ],
    stages: ['Research', 'Write', 'Verify', 'Publish'],
  },

  // --- Marketing ---
  {
    id: 'social',
    teamId: '6',
    group: 'marketing',
    icon: SocialIcon,
    titleKey: 'social_media_squad',
    descriptionKey: 'social_media_squad_description',
    estimatedCredits: { min: 5, max: 25 },
    integrations: [
      { icon: RedditIcon, name: 'Reddit' },
      { icon: TwitterIcon, name: 'Twitter' },
      { icon: LinkedInIcon, name: 'LinkedIn' },
      { icon: FacebookIcon, name: 'Facebook' },
      { icon: SiInstagram, name: 'Instagram' },
    ],
    sampleUrl: 'https://blog.promarkia.com/wp-content/uploads/2025/07/Screenshot-2025-07-03-205037.png',
    samplePrompts: [
      'Create a LinkedIn post about our new AI product launch and post it',
      'Find 5 Reddit posts about SaaS marketing and write engaging comments',
    ],
    stages: ['Plan', 'Create', 'Post', 'Verify'],
  },
  {
    id: 'email_marketing',
    teamId: '16',
    group: 'marketing',
    icon: EmailIcon,
    titleKey: 'email_marketing_squad',
    descriptionKey: 'email_marketing_squad_description',
    estimatedCredits: { min: 5, max: 25 },
    integrations: [
      { icon: GmailIcon, name: 'Gmail' },
      { icon: OutlookIcon, name: 'Outlook' },
    ],
    sampleUrl: '',
    samplePrompts: [
      'Create a 5-email nurture sequence for SaaS free trial users',
      'Write a product launch announcement email with A/B subject lines',
    ],
    stages: ['Strategy', 'Research', 'Write', 'Verify', 'Send'],
  },
  {
    id: 'seo',
    teamId: '8',
    group: 'marketing',
    icon: SeoIcon,
    titleKey: 'seo_expert_squad',
    descriptionKey: 'seo_expert_squad_description',
    estimatedCredits: { min: 5, max: 20 },
    integrations: [
      { icon: GoogleIcon, name: 'Google' },
    ],
    sampleUrl: 'https://blog.promarkia.com/wp-content/uploads/2025/07/Webpage_SEO_Review.pdf',
    samplePrompts: [
      'Do a full SEO audit of https://www.promarkia.com',
      'Find the best keywords for "AI marketing automation" with search volumes',
    ],
    stages: ['Research', 'Analyze', 'Optimize', 'Report'],
  },
  {
    id: 'campaign',
    teamId: '9',
    group: 'marketing',
    icon: CampaignIcon,
    titleKey: 'campaign_planner_squad',
    descriptionKey: 'campaign_planner_squad_description',
    estimatedCredits: { min: 8, max: 30 },
    integrations: [
      { icon: DescriptionIcon, name: 'Google Docs' },
      { icon: NotionIcon, name: 'Notion' },
      { icon: GoogleSheetsIcon, name: 'Sheets' },
    ],
    sampleUrl: 'https://blog.promarkia.com/wp-content/uploads/2025/07/Two-Year-Comprehensive-Marketing-Strategy-Plan-for-Agentix-Labs.pdf',
    samplePrompts: [
      'Create a Q3 marketing plan for a B2B SaaS company with $50K budget',
      'Build a product launch campaign plan for a new mobile app',
    ],
    stages: ['Strategy', 'Plan', 'Execute', 'Report'],
  },
  {
    id: 'ads',
    teamId: '10',
    group: 'marketing',
    icon: AdsIcon,
    titleKey: 'digital_ads_squad',
    descriptionKey: 'digital_ads_squad_description',
    estimatedCredits: { min: 5, max: 20 },
    integrations: [
      { icon: GoogleIcon, name: 'Google' },
      { icon: LinkedInIcon, name: 'LinkedIn' },
      { icon: TwitterIcon, name: 'Twitter' },
      { icon: SiTiktok, name: 'TikTok' },
    ],
    sampleUrl: 'https://blog.promarkia.com/wp-content/uploads/2025/07/Screenshot-2025-07-03-215133.png',
    samplePrompts: [
      'Create Google Ads for "AI marketing platform" targeting small businesses',
      'Generate LinkedIn ad copy for a B2B lead gen campaign with UTM tracking',
    ],
    stages: ['Strategy', 'Create', 'Verify', 'Launch'],
  },
  {
    id: 'brand',
    teamId: '19',
    group: 'marketing',
    icon: BrandIcon,
    titleKey: 'brand_guidelines_squad',
    descriptionKey: 'brand_guidelines_squad_description',
    estimatedCredits: { min: 5, max: 20 },
    integrations: [],
    sampleUrl: '',
    samplePrompts: [
      'Audit this blog post against our brand guidelines: [paste content]',
      'Rewrite this email to match a professional but friendly B2B tone',
    ],
    stages: ['Audit', 'Check', 'Rewrite', 'Verify', 'Deliver'],
  },

  // --- Sales & Data ---
  {
    id: 'lead',
    teamId: '13',
    group: 'sales',
    icon: LeadIcon,
    titleKey: 'lead_generation_squad',
    descriptionKey: 'lead_generation_squad_description',
    estimatedCredits: { min: 5, max: 20 },
    integrations: [
      { icon: LinkedInIcon, name: 'LinkedIn' },
      { icon: HubIcon, name: 'Hubspot' },
      { icon: SalesforceIcon, name: 'Salesforce' },
      { icon: AcUnitIcon, name: 'Apollo' },
      { icon: TbLetterZ, name: 'ZoomInfo' },
    ],
    sampleUrl: 'https://blog.promarkia.com/wp-content/uploads/2025/07/Screenshot-2025-07-03-224715.png',
    samplePrompts: [
      'Find 20 SaaS companies in the AI marketing space with contact emails',
      'Research trucking companies in Ontario with FMCSA data',
    ],
    stages: ['Search', 'Enrich', 'Verify', 'Deliver'],
  },
  {
    id: 'competitor',
    teamId: '18',
    group: 'sales',
    icon: CompetitorIcon,
    titleKey: 'competitor_intelligence_squad',
    descriptionKey: 'competitor_intelligence_squad_description',
    estimatedCredits: { min: 5, max: 20 },
    integrations: [
      { icon: GoogleIcon, name: 'Google' },
      { icon: DescriptionIcon, name: 'Google Docs' },
    ],
    sampleUrl: '',
    samplePrompts: [
      'Analyze competitors HubSpot, Marketo, and Mailchimp against our platform',
      'Do a SWOT analysis comparing us to our top 3 competitors',
    ],
    stages: ['Scan', 'Analyze', 'Verify', 'Report'],
  },
  {
    id: 'analytics',
    teamId: '17',
    group: 'sales',
    icon: AnalyticsIcon,
    titleKey: 'analytics_squad',
    descriptionKey: 'analytics_squad_description',
    estimatedCredits: { min: 5, max: 20 },
    integrations: [
      { icon: GoogleIcon, name: 'Google Analytics' },
      { icon: GoogleSheetsIcon, name: 'Sheets' },
      { icon: DescriptionIcon, name: 'Google Docs' },
    ],
    sampleUrl: '',
    samplePrompts: [
      'Generate a monthly marketing performance report from Google Analytics',
      'Combine our Google Sheets sales data with GA traffic and create a report',
    ],
    stages: ['Collect', 'Analyze', 'Verify', 'Report'],
  },
  {
    id: 'data',
    teamId: '12',
    group: 'sales',
    icon: DataIcon,
    titleKey: 'data_scientist_squad',
    descriptionKey: 'data_scientist_squad_description',
    estimatedCredits: { min: 5, max: 20 },
    integrations: [
      { icon: GoogleIcon, name: 'Google Analytics' },
      { icon: GoogleSheetsIcon, name: 'Sheets' },
    ],
    sampleUrl: '',
    samplePrompts: [
      'Analyze this CSV file and show me the top trends',
      'Pull our Google Analytics data for the last 30 days and create charts',
    ],
    stages: ['Collect', 'Analyze', 'Visualize', 'Report'],
  },
  {
    id: 'coders',
    teamId: '11',
    group: 'sales',
    icon: CodingIcon,
    titleKey: 'coders_squad',
    descriptionKey: 'coders_squad_description',
    estimatedCredits: { min: 5, max: 15 },
    integrations: [],
    sampleUrl: '',
    samplePrompts: [
      'Write a Python script to scrape product prices from a URL',
      'Create a React component for a pricing table with 3 tiers',
    ],
    stages: ['Understand', 'Code', 'Verify', 'Deliver'],
  },
];


// ============================================================
// SQUAD GROUPS (for accordion navigation)
// ============================================================

export const squadGroups = [
  {
    id: 'general_group',
    labelKey: 'group_general',
    defaultLabel: 'General',
    iconName: 'DashboardIcon',
  },
  {
    id: 'content',
    labelKey: 'group_content_creation',
    defaultLabel: 'Content Creation',
    iconName: 'BrushIcon',
  },
  {
    id: 'marketing',
    labelKey: 'group_marketing',
    defaultLabel: 'Marketing',
    iconName: 'RocketLaunchIcon',
  },
  {
    id: 'sales',
    labelKey: 'group_sales_data',
    defaultLabel: 'Sales & Data',
    iconName: 'ShowChartIcon',
  },
];
