# UsageBar Changelog

## [1.0.2] - 2024-12-29

### Added
- Browser-based login for Cursor (auto-captures session cookies)
- GitHub OAuth device flow for Copilot
- Browser login for Claude (paid plans only)
- Provider documentation in `docs/` folder (inspired by CodexBar)
- Provider authoring guide

### Fixed
- Claude free tier now shows honest message (no usage API)
- Provider error messages clearly indicate login status
- Acknowledgement corrected to @steipete (CodexBar author)

### Security
- Session files stored in AppData (not project folder)
- Added session/token patterns to .gitignore

---

## [1.0.1] - 2024-12-28

### Added
- Settings window UI improvements
- Shadcn-inspired dark theme

---

## [1.0.0] - 2024-12-28

### Added
- Initial release for Windows (inspired by CodexBar for Mac)
- System tray integration with dynamic usage meter icon
- Antigravity provider support (Windows language server detection)
- Claude Code provider support
- Codex provider support
- Copilot provider support
- Settings window with provider toggles
- Configurable refresh intervals (1m, 2m, 5m, 15m)
- Auto-start on Windows boot option
- Windows installer (NSIS) and portable builds
