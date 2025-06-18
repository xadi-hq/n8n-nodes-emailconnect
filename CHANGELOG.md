# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-06-18

### Added
- Initial release of EmailConnect n8n community node
- EmailConnect node with three main resources:
  - **Domain operations**: List, get details, check status, update configuration
  - **Alias operations**: Full CRUD operations for email aliases
  - **Webhook operations**: Full CRUD operations for webhook management
- EmailConnect Trigger node for real-time email processing notifications
- Event filtering support (email.received, email.processed, email.failed)
- Domain and alias filtering for precise workflow control
- Complete API integration with EmailConnect "API User" scope
- Comprehensive test suite for node validation
- Full documentation with usage examples and troubleshooting guide

### Security
- Implements EmailConnect API key authentication
- Supports scoped API access with "API User" permissions
- Secure webhook handling for trigger node

### Technical Details
- Built with TypeScript for type safety
- Compatible with n8n API version 1
- Follows n8n community node best practices
- Includes proper error handling and user feedback
- SVG icon integration for consistent UI experience

## [Unreleased]

### Planned Features
- Enhanced error messages with specific API error codes
- Batch operations for multiple aliases/webhooks
- Email content parsing utilities
- Advanced filtering options for trigger node
- Performance optimizations for large domain lists

---

For more details about each release, see the [GitHub releases page](https://github.com/xadi-hq/n8n-nodes-emailconnect/releases).
