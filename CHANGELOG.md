# Changelog

## [0.4.7] - 2024-12-02

### Added

- Added export for errors/index.js module for better error handling
- Added Vitest support for testing, replacing Jest
- Added MongoDB 6.0 support
- Added basic usage examples in README for label creation and querying

### Changed

- Improved MongoDB date handling in label operations:
  - Storing dates as ISO strings for better compatibility
  - Enhanced filtering of expired labels using MongoDB queries
- Updated LabelerServer with improved error handling
- Migrated test framework from Jest to Vitest:
  - Removed Jest configuration files
  - Added Vitest configuration
  - Updated test files for Vitest compatibility
- Enhanced ESLint configuration to properly ignore coverage files

### Fixed

- Fixed expired label filtering in MongoDB queries
- Fixed date comparison issues in label operations
- Fixed test cases to properly handle expired labels

## [0.4.6] - 2024-12-01

### Changed

- Enhanced version validation in label schema:
  - Modified `CreateLabelData` interface to allow any number in `ver` field for testing flexibility
  - Added runtime validation in `createLabel` to ensure `ver` is always 1
  - Improved test coverage for version validation scenarios

## [0.4.5] - 2024-12-01

### Added

- New `validateUri` function that properly handles both `did:` and `at://` URIs
- Warning when creating a label for an `at://` URI without a CID

### Changed

- Improved URI and CID validation to follow atproto specification:
  - CID is not allowed for `did:` URIs
  - CID is recommended but optional for `at://` URIs
  - CID field is now omitted from the label object when not provided
- Enhanced error messages for URI validation
- Marked `validateAtUri` as deprecated in favor of `validateUri`
- Simplified type definitions:
  - `CreateLabelData` now extends from `UnsignedLabel`
  - Removed duplicate field definitions
  - Enforced literal type `1` for `ver` field

### Fixed

- Validation now correctly handles the relationship between URI types and CID
- Test coverage improved for URI and CID validation scenarios

## [0.4.4] - 2024-12-01

### Changed

- Improved package exports configuration with better module resolution
- Simplified index.ts exports using `export *` for utility modules
- Added CHANGELOG.md to package files

## [0.4.3] - 2024-12-01

### Changed

- Enhanced package exports configuration to better support TypeScript types
- Improved module resolution for both ESM and CommonJS environments
- Updated package.json exports field with explicit type declarations

## [0.4.2] - 2024-12-01

### Fixed

- Fixed MongoDB client initialization to properly handle database and collection names
- Improved error handling in database connection process
- Simplified MongoDB client setup in LabelerServer

## [0.4.1] - 2024-12-01

### Fixed

- Enhanced error handling in MongoDB client operations
- Improved error message consistency in _getNextId method
- Fixed MongoDB collection mocks in tests for better reliability
- Optimized error propagation in saveLabel method
- Removed unused variables and improved test clarity

## [0.4.0] - 2024-11-30

### Changed

- Migrated test framework from Jest to Vitest for improved performance and developer experience
- Enhanced test execution and coverage workflow configuration
- Optimized test configuration with improved timeout settings
- Updated test script in coverage workflow with better handling of completion
- Improved CI/CD pipeline configuration and performance

## [0.3.3] - 2024-11-29

### Fixed

- Fixed hanging tests in CI environment
- Optimized Jest configuration for CI environments
- Improved MongoDB Memory Server handling in tests

### Changed

- Updated GitHub Actions workflow configuration
- Modified timeout and log management in CI
- Added timeout control to prevent infinite test execution

## [0.3.2] - 2024-11-29

### Changed

- Improved ESLint configuration for test files
- Added explicit `strictNullChecks` configuration in tsconfig.json
- Disabled specific ESLint rules for test files for better Jest compatibility

## [0.3.1] - 2024-11-29

### Added

- Added Jest global setup file for configuring test environment
- Added AT Protocol Technical Cheatsheet and MongoDB setup documentation
- Added global timer mock setup and cleanup functions

### Changed

- Enhanced Jest timeout configuration for tests
- Improved cleanup logic in test environment
- Refactored clearTimeout function and test cleanup actions
- Added original Date.now tracking in Jest setup for better time handling in tests

## [0.3.0] - 2024-11-29

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

## [0.2.9] - 2024-11-27

### Changed

- Enhanced MongoDB client configuration
- Improved error handling in database operations
- Updated documentation with more examples

## [0.2.8] - 2024-11-27

### Changed

- Updated MongoDB client implementation
- Enhanced error handling
- Improved type definitions

## [0.2.7] - 2024-11-26

### Changed

- Enhanced MongoDB operations
- Improved error handling
- Updated documentation

## [0.2.6] - 2024-11-26

### Changed

- Updated MongoDB client
- Enhanced error messages
- Improved type safety

## [0.2.5] - 2024-11-26

### Changed

- Enhanced database operations
- Improved error handling
- Updated documentation

## [0.2.4] - 2024-11-24

### Changed

- Updated MongoDB operations
- Enhanced error handling
- Improved documentation

## [0.2.3] - 2024-11-24

### Changed

- Enhanced database client
- Improved error messages
- Updated type definitions

## [0.2.2] - 2024-11-24

### Changed

- Updated MongoDB operations
- Enhanced error handling
- Improved documentation

## [0.2.1] - 2024-11-24

### Changed

- Enhanced database client
- Improved error messages
- Updated type definitions

## [0.2.0] - 2024-11-23

### Changed

- Major update to MongoDB operations
- Enhanced error handling system
- Improved type safety
- Updated documentation

## [0.1.4] - 2024-11-23

### Changed

- Updated MongoDB client
- Enhanced error handling
- Improved documentation

## [0.1.3] - 2024-11-21

### Changed

- Enhanced database operations
- Improved error messages
- Updated type definitions

## [0.1.2] - 2024-11-21

### Changed

- Updated MongoDB client
- Enhanced error handling
- Improved documentation

## [0.1.1] - 2024-11-21

### Changed

- Initial release with basic MongoDB operations
- Basic error handling
- Initial documentation
