# Changelog

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
