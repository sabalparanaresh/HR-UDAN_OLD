export default [
  {
      ignores: ["dist/**", "dist-server/**", "node_modules/**", "**/*.js", "scripts/**"],
  },
  {
      rules: {
          "no-unused-vars": "off",
          "no-undef": "off",
          "@typescript-eslint/no-explicit-any": "off",
      }
  }
];
