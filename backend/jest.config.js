/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Chỉ quét trong thư mục tests/
  testMatch: ['**/tests/**/*.test.ts'],
  // Tắt output console khi chạy test (bật lại bằng --verbose)
  silent: false,
  // Đặt KNOWLEDGE_ROOT để test dùng thư mục test fixture thay vì production
  setupFiles: [],
};
