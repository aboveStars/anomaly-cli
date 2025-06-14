# Anomaly CLI

A powerful command-line interface tool for anomaly detection and management with Firebase authentication.

## Installation

Install globally to use the `anomaly` command anywhere:

```bash
npm install -g anomaly-cli
```

## Usage

After installation, you can use the `anomaly` command in your terminal:

```bash
# Get CLI information
anomaly info

# Authentication
anomaly auth login    # Sign in to your account
anomaly auth status   # Check authentication status
anomaly auth logout   # Sign out

# Main commands (require authentication)
anomaly profile       # View your profile
anomaly dashboard     # Open your dashboard
anomaly list          # List contents of current directory
anomaly create        # Create a new app by zipping and uploading your project

# Get help
anomaly --help
```

## Features

- 🔐 **Firebase Authentication** - Secure login system
- 📁 **Directory Management** - List and manage directory contents
- 🚀 **App Creation** - Zip and upload your projects
- 💻 **User-Friendly Interface** - Beautiful colored output with intuitive commands
- 📊 **Dashboard Integration** - Access your personalized dashboard

## Requirements

- Node.js 16.0.0 or higher
- npm or yarn

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

If you encounter any issues or have questions, please file an issue on the GitHub repository.
