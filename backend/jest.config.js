/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  // Chỉ quét trong thư mục tests/
  testMatch: ['**/tests/**/*.test.ts'],
  // Tắt output console khi chạy test (bật lại bằng --verbose)
  silent: false,
  // Đặt KNOWLEDGE_ROOT để test dùng thư mục test fixture thay vì production
  setupFiles: [],
  // Dùng tsconfig riêng cho test để có Jest types mà không ảnh hưởng tsconfig production
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
};
