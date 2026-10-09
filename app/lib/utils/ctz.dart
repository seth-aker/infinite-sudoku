int ctz(int n) {
  if (n == 0) return 64; // Or 32 depending on platform context

  int count = 0;
  while ((n & 1) == 0) {
    count++;
    n >>= 1;
  }
  return count;
}
