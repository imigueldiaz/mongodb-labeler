# Changelog

## [0.3.3] - 2024-03-19

### Fixed

- Fixed hanging tests in CI environment
- Optimized Jest configuration for CI environments
- Improved MongoDB Memory Server handling in tests

### Changed

- Updated GitHub Actions workflow configuration
- Modified timeout and log management in CI
- Added timeout control to prevent infinite test execution


## [0.3.2] - 2024-01-19

### Changed

- Improved ESLint configuration for test files
- Added explicit `strictNullChecks` configuration in tsconfig.json
- Disabled specific ESLint rules for test files for better Jest compatibility

## [0.3.1] - 2024-01-19

### Added

- Added Jest global setup file for configuring test environment
- Added AT Protocol Technical Cheatsheet and MongoDB setup documentation
- Added global timer mock setup and cleanup functions

### Changed

- Enhanced Jest timeout configuration for tests
- Improved cleanup logic in test environment
- Refactored clearTimeout function and test cleanup actions
- Added original Date.now tracking in Jest setup for better time handling in tests

## [0.3.0] - 2024-01-17

### Added

- Added validation for expired timestamps in `queryLabels` before making database queries
- Improved error handling for timestamp validation errors with clearer error messages
- Added `date-fns` library integration for more accurate date validation

### Changed

- Enhanced timestamp validation logic to use `getDaysInMonth` from `date-fns`
- Refactored error handling in `queryLabels` to properly propagate validation errors
- Updated validation error messages to be more descriptive and consistent

### Fixed

- Fixed timestamp validation to correctly handle days in months
- Fixed error message format in timestamp validation errors
- Fixed handling of expired labels in queries to be more consistent with validation rules

### Testing

- Added comprehensive tests for timestamp validation edge cases
- Improved test coverage for expired label handling
- Added tests for date validation with different month lengths and leap years

### Dependencies

- Added `date-fns` for improved date handling and validation
