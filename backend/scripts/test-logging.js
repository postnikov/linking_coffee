// Test script to verify logging functionality
console.log('Test script started');
console.log('This is a normal log message');
console.log('Testing multi-line output:');
console.log('  Line 1');
console.log('  Line 2');
console.log('  Line 3');

// Simulate some work
const start = Date.now();
let sum = 0;
for (let i = 0; i < 1000000; i++) {
  sum += i;
}
const duration = Date.now() - start;

console.log(`Calculation completed in ${duration}ms`);
console.log(`Sum: ${sum}`);

// Test error output
console.error('This is a test error message (not a real error)');

console.log('Test script completed successfully');

process.exit(0);
