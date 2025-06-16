# Contributing to MCP Sleeper Server

First off, thank you for considering contributing to MCP Sleeper Server! It's people like you that make this project better for everyone.

## Code of Conduct

By participating in this project, you are expected to uphold our code of conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear and descriptive title**
- **Detailed description** of the issue
- **Steps to reproduce** the behavior
- **Expected behavior** description
- **Screenshots** if applicable
- **Environment details** (OS, Node version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear and descriptive title**
- **Detailed description** of the proposed functionality
- **Rationale** - why this enhancement would be useful
- **Examples** of how it would work
- **Alternative solutions** you've considered

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the setup instructions** in the README
3. **Make your changes:**
   - Write clear, commented code
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed
4. **Test your changes:**
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```
5. **Commit your changes:**
   - Use clear and meaningful commit messages
   - Follow conventional commits format:
     ```
     feat: add new player statistics endpoint
     fix: correct rate limiting calculation
     docs: update API examples
     test: add integration tests for draft methods
     ```
6. **Push to your fork** and submit a pull request
7. **Describe your PR** clearly, linking any related issues

## Development Process

### Project Structure

```
src/
├── api/          # Sleeper API client
├── cache/        # Caching layer
├── middleware/   # Express middleware
├── openrpc/      # OpenRPC documentation
├── rpc/          # JSON-RPC method handlers
├── server/       # Express server setup
├── test/         # Test files
├── types/        # TypeScript type definitions
└── utils/        # Utility functions
```

### Adding New Methods

1. **Define the method** in the appropriate file under `src/rpc/methods/`
2. **Add validation schema** using Zod
3. **Implement API client method** if needed in `src/api/client.ts`
4. **Add tests** for the new method
5. **Update OpenRPC specification** in `src/openrpc/document.ts`
6. **Update documentation** with examples

Example of adding a new method:

```typescript
// src/rpc/methods/league.ts
const getLeagueSettingsSchema = z.object({
  leagueId: z.string().min(1).describe('League ID'),
});

export const leagueMethods = {
  // ... existing methods
  
  'sleeper.getLeagueSettings': async (params: unknown) => {
    const validated = validateParams(params, getLeagueSettingsSchema);
    return sleeperAPI.getLeagueSettings(validated.leagueId);
  },
};
```

### Testing Guidelines

- **Unit tests** for individual functions and methods
- **Integration tests** for API endpoints
- **Mock external dependencies** (Sleeper API, Redis)
- **Aim for 80%+ code coverage**
- **Test error scenarios** and edge cases

### Code Style

- **TypeScript** - Use strict mode and proper typing
- **ESLint** - Run `npm run lint` before committing
- **Prettier** - Run `npm run format` to auto-format
- **Comments** - Add JSDoc comments for public methods
- **Naming** - Use descriptive names, follow existing patterns

### Performance Considerations

- **Caching** - Use appropriate TTL values for different endpoints
- **Rate limiting** - Respect Sleeper's API limits
- **Error handling** - Fail gracefully, provide useful error messages
- **Logging** - Use appropriate log levels

## Release Process

1. **Version bump** - Update version in `package.json`
2. **Update CHANGELOG.md** - Document all changes
3. **Create release PR** - Target `main` branch
4. **Tag release** - After merging, create GitHub release
5. **Docker image** - Automatically built and pushed via CI

## Getting Help

- **Discord** - Join our community server
- **GitHub Issues** - For bugs and features
- **Discussions** - For questions and ideas
- **Email** - support@example.com

## Recognition

Contributors will be recognized in:
- The README.md contributors section
- Release notes for their contributions
- Our Discord community

Thank you for contributing! 🏈