enum DifficultyRating {
  beginner,
  easy,
  medium,
  hard,
  // impossible;
;
  @override
  String toString() {
    return name.substring(0, 1).toUpperCase() + name.substring(1);
  }

  factory DifficultyRating.fromString(String str) {
    switch (str) {
      case 'Beginner':
        return beginner;
      case 'Easy':
        return easy;
      case 'Medium':
        return medium;
      case 'Hard':
        return hard;
      // case 'Impossible':
      //   return impossible;
      default:
        return beginner;
    }
  }
}
