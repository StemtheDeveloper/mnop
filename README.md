# M'NOP Platform

**Market, Nurture, Optimize, Profit** - A collaborative marketplace connecting designers, manufacturers, investors, and customers.

![M'NOP Logo](src/assets/logos/mnop-logo.png) <!-- Add this if you have a logo image -->

## Overview

M'NOP is a comprehensive platform that facilitates the entire product lifecycle from idea to market. It creates a collaborative ecosystem where:

- **Designers** can showcase their product ideas and find manufacturing partners
- **Manufacturers** can offer production services and connect with innovative designers
- **Investors** can discover promising products to fund and earn returns
- **Customers** can discover unique products and support them from concept to reality

## Key Features

### User Authentication & Authorization

- Multi-factor authentication for enhanced security
- Role-based access control (customer, designer, manufacturer, investor, admin)
- Social media integration (Google, Facebook, Twitter)
- Profile management and verification system

### Product Development

- Product idea submission and management
- Collaboration tools between designers and manufacturers
- Progress tracking and milestone management
- Investment opportunities and funding campaigns

### Marketplace

- Product catalog with advanced search and filtering
- Shopping cart and order processing
- Transaction management with wallet system
- Review and rating system

### Financial Features

- Wallet and transaction management
- Investment processing with interest calculations
- Revenue distribution system
- Exchange rate updates

### Community Building

- Achievement system and badges
- Notification center
- Messaging system
- User profiles with stats and history

## Technology Stack

- **Frontend**: React 19 with Vite
- **Backend**: Firebase (Authentication, Firestore, Storage, Functions)
- **Styling**: CSS with responsive design
- **State Management**: React Context API
- **Localization**: i18next for internationalization
- **Form Handling**: Formspree
- **Security**: Two-factor authentication, end-to-end encryption

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Firebase project setup

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/mnop-app.git
   cd mnop-app
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn
   ```

3. Create a `.env` file in the root directory with your Firebase configuration:

   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

4. Start the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) to view the app in your browser.

### Firebase Setup

1. Create a new Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Authentication methods (Email/Password, Google, Facebook, Twitter)
3. Create a Firestore database and configure security rules
4. Set up Firebase Storage for media files
5. Deploy Firebase Functions for serverless operations:
   ```bash
   cd functions
   npm install
   npm run deploy
   ```

## Project Structure

```
src/
├── assets/          # Static assets, images, icons
├── components/      # Reusable UI components
├── config/          # Configuration files (Firebase, etc.)
├── context/         # React context providers
├── hooks/           # Custom React hooks
├── locales/         # Internationalization files
├── pages/           # Application pages/views
├── services/        # Service layer for API interactions
├── styles/          # Global styles and themes
└── utils/           # Utility functions and helpers
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run deploy` - Build and deploy to Firebase hosting

## Feature Documentation

### Image Cropping

The platform includes an image cropping feature for user avatars and product images.

Dependencies:

```bash
npm install react-image-crop
```

Usage examples can be found in `src/components/ImageCropper.jsx`.

### Two-Factor Authentication

M'NOP implements phone-based two-factor authentication using Firebase Authentication.

Setup steps:

1. Navigate to your profile page
2. Click on "Set up 2FA" in the security settings section
3. Enter your phone number and verify with the code sent via SMS

### Wallet System

The platform includes a digital wallet for:

- Processing investments
- Receiving returns on investments
- Managing product sales revenue
- Facilitating secure transactions

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For any questions or inquiries, please contact the M'NOP team at support@mnop.example.com.
