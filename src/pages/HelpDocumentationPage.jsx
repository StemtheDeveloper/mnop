import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../styles/HelpDocumentationPage.css';

const HelpDocumentationPage = () => {
    const [activeCategory, setActiveCategory] = useState('getting-started');

    // Help content organized by categories
    const helpContent = {
        'getting-started': {
            title: 'Getting Started',
            content: `
# Getting Started with M'NOP

Welcome to the M'NOP platform! This guide will help you understand the basics of our platform and how to get started.

## What is M'NOP?

M'NOP is a collaboration platform that connects designers, manufacturers, and investors to bring innovative products to market. Our platform allows:

- **Designers** to showcase their product designs
- **Manufacturers** to find designs to produce
- **Investors** to fund promising products
- **Customers** to discover and purchase unique products

## Creating Your Account

1. Click on the "Register" button in the top right corner
2. Fill in your personal information
3. Select your primary role (Designer, Manufacturer, Investor, or Customer)
4. Verify your email address
5. Complete your profile with additional information

## Using Multiple Roles

On M'NOP, users can have multiple roles. For example, you might be both a designer and an investor. To request additional roles:

1. Go to your Profile page
2. Click on the "Account Settings" tab
3. Under "Account Type", select the role you'd like to add
4. Click "Request Role"

An administrator will review your request and approve it if appropriate.
`
        },
        'designers': {
            title: 'For Designers',
            content: `
# Designer Resources

As a designer on M'NOP, you have powerful tools to showcase your creations and connect with manufacturers and investors.

## Uploading Designs

To upload a new design:

1. Navigate to your dashboard
2. Click "Upload New Design"
3. Fill in the product details including name, description, and category
4. Upload high-quality images of your design
5. Set your pricing information
6. Click "Submit Design"

## Getting Manufacturing Quotes

Once your design is uploaded:

1. Go to your product page
2. Click "Request Manufacturing Quote"
3. Fill in the manufacturing requirements form
4. Submit your request to our network of manufacturers
5. Compare quotes when they arrive in your inbox

## Managing Design Revisions

To update your designs:

1. Go to "My Designs" in your dashboard
2. Find the design you want to revise
3. Click "Edit Design"
4. Make your changes and save

## Design Protection

M'NOP helps protect your intellectual property:

- All uploaded designs receive a timestamp of submission
- Watermarking is available for image uploads
- Manufacturers sign NDAs before accessing detailed design files
`
        },
        'manufacturers': {
            title: 'For Manufacturers',
            content: `
# Manufacturer Resources

As a manufacturer on M'NOP, you can connect with designers and fulfill production needs.

## Finding Design Opportunities

To find designs to manufacture:

1. Browse the "Designs for Production" section
2. Filter by category, materials, or production size
3. Click on designs you're interested in to view details

## Submitting Quotes

When you find a design you'd like to produce:

1. Review the manufacturing requirements
2. Click "Submit Quote"
3. Fill in your price estimate, timeline, and capabilities
4. Add any notes or questions for the designer
5. Submit your quote for the designer's review

## Managing Production Orders

Once your quote is accepted:

1. Review and confirm the production agreement
2. Use our project management tools to track progress
3. Communicate with designers through the platform
4. Update production status as you complete milestones
`
        },
        'investors': {
            title: 'For Investors',
            content: `
# Investor Resources

As an investor on M'NOP, you can discover and support promising product designs.

## Finding Investment Opportunities

To find designs to invest in:

1. Browse the "Investment Opportunities" section
2. Filter by category, funding stage, or investment size
3. Review product details, market analysis, and funding requirements
4. Add promising products to your watchlist

## Making an Investment

When you're ready to invest:

1. Click "Invest in This Product" on the product page
2. Select your investment amount
3. Review the terms and expected returns
4. Complete the investment process securely

## Managing Your Portfolio

To manage your investments:

1. Go to "My Portfolio" in your dashboard
2. View performance metrics and updates for all your investments
3. Track important milestones and communications
4. Review dividend and return information
`
        },
        'customers': {
            title: 'For Customers',
            content: `
# Customer Resources

As a customer on M'NOP, you can discover and purchase unique products that aren't available anywhere else.

## Shopping on M'NOP

To browse and purchase products:

1. Visit the "Shop" section
2. Filter products by category, price, or designer
3. Click on a product to see details, reviews, and purchasing options
4. Add items to your cart and proceed to checkout

## Pre-orders and Crowdfunding

Some products on M'NOP are available for pre-order or through crowdfunding:

1. Products labeled "Pre-order" will be produced after you order
2. Products labeled "Crowdfunding" need to reach a funding goal before production
3. Estimated shipping dates are provided for all pre-order items

## Managing Orders

To track your orders:

1. Go to "My Orders" in your account
2. View order status, shipping information, and delivery estimates
3. Contact support if you need assistance with an order
`
        },
        'faq': {
            title: 'Frequently Asked Questions',
            content: `
# Frequently Asked Questions

## General Questions

### What is M'NOP?
M'NOP is a platform that connects designers, manufacturers, investors, and customers to bring innovative products to market.

### How do I create an account?
Click "Register" in the top right corner of the site and follow the step-by-step instructions to create your account.

### Can I have multiple roles on M'NOP?
Yes, you can request additional roles from your Profile page under "Account Settings."

### How do you protect my data?
We use industry-standard encryption and security practices to protect your personal and financial information. Please see our Privacy Policy for details.

## For Designers

### How do I get paid for my designs?
Designers earn revenue through:
- Direct sales of products (with a percentage fee to M'NOP)
- Licensing agreements with manufacturers
- Crowdfunded campaigns

### How do I protect my intellectual property?
All designs uploaded to M'NOP receive a timestamp and are protected under our Terms of Service. We also offer watermarking and NDA options.

## For Manufacturers

### How do I find designs to manufacture?
Browse the "Designs for Production" section and filter by categories relevant to your manufacturing capabilities.

### How does the quoting process work?
You can submit quotes for designs, specifying your price, timeline, and capabilities. Designers can then accept, reject, or negotiate your quote.

## For Investors

### What types of investments can I make?
You can invest in individual products or designer portfolios, with various investment structures including equity, revenue share, and loans.

### What are the minimum investment amounts?
Minimum investments vary by product, but typically start at $1,000.

## For Customers

### How do I track my order?
Go to "My Orders" in your account dashboard to view order status and shipping information.

### What is your return policy?
Our return policy varies by product type. Generally, products can be returned within 30 days if they're in original condition. Custom-made items may have different policies.
`
        },
        'troubleshooting': {
            title: 'Troubleshooting',
            content: `
# Troubleshooting

## Account Issues

### I can't log in to my account
- Make sure you're using the correct email address and password
- Check if Caps Lock is on
- Click "Forgot Password" to reset your password
- Clear your browser cache and cookies
- Try using a different browser

### I haven't received my verification email
- Check your spam/junk folder
- Add support@mnop.com to your contacts
- Try requesting another verification email
- Contact support if the issue persists

## Upload Problems

### My design uploads are failing
- Check that your file is under the 20MB size limit
- Ensure you're using supported file formats (.jpg, .png, .pdf)
- Try compressing your images before uploading
- Use a wired internet connection for more stability

### My product images aren't displaying correctly
- Make sure images are at least 1200x800 pixels
- Use the recommended aspect ratio of 3:2
- Check that images are in RGB color mode
- Try re-uploading the images

## Payment Issues

### My payment was declined
- Verify your card information is correct
- Check with your bank if there are any restrictions
- Try using a different payment method
- Ensure your billing address matches your card information

### I haven't received my payout
- Confirm your banking information is correct in your profile
- Note that payouts are processed every Monday
- Allow 3-5 business days for the transfer to complete
- Contact support if it's been more than 7 business days

## Technical Problems

### The website is loading slowly
- Clear your browser cache and cookies
- Disable browser extensions that might interfere
- Check your internet connection
- Try using a different browser

### I found a bug on the site
Please report any bugs by:
1. Going to your profile
2. Clicking "Report a Problem"
3. Describing the issue in detail
4. Including screenshots if possible
`
        },
        'contact': {
            title: 'Contact Support',
            content: `
# Contact Support

## Support Options

Our support team is here to help you with any questions or issues you may have.

### Email Support

For general inquiries and non-urgent issues, please email us at:
**support@mnop.com**

We aim to respond to all emails within 1 business day.

### Live Chat

For immediate assistance, use our live chat feature available Monday-Friday, 9AM-5PM EST.
To access live chat:
1. Click on your profile icon
2. Select "Help & Support"
3. Click "Start Chat"

### Phone Support

For urgent matters, call our support line:
**1-800-MNOP-HELP (1-800-666-7435)**

Phone support hours:
- Monday-Friday: 9AM-7PM EST
- Saturday: 10AM-4PM EST
- Sunday: Closed

## Reporting Issues

When reporting technical issues, please include:
- Your account email
- Device and browser information
- Screenshots of the issue
- Steps to reproduce the problem

## Feature Requests

We're always looking to improve! Submit feature requests by:
1. Going to your profile
2. Clicking "Feedback"
3. Selecting "Feature Request"
4. Describing your idea in detail

We review all feature requests and prioritize based on user demand and feasibility.
`
        },
    };

    return (
        <div className="help-documentation-page">
            <div className="help-container">
                <h1 className="help-main-title">Help & Documentation</h1>

                <div className="help-content-wrapper">
                    <div className="help-sidebar">
                        <div className="help-categories">
                            {Object.entries(helpContent).map(([key, category]) => (
                                <button
                                    key={key}
                                    className={`category-button ${activeCategory === key ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(key)}
                                >
                                    {category.title}
                                </button>
                            ))}
                        </div>

                        <div className="help-support-box">
                            <h3>Need more help?</h3>
                            <p>Our support team is ready to assist you with any questions.</p>
                            <a href="/contact" className="support-link">Contact Support</a>
                        </div>
                    </div>

                    <div className="help-content">
                        <div className="markdown-content">
                            <ReactMarkdown
                                children={helpContent[activeCategory].content}
                                remarkPlugins={[remarkGfm]}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpDocumentationPage;
