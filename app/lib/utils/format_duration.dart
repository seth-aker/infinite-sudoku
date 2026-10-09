const minute = 60;
const hour = 60 * 60;
String formatDuration(int elapsedSeconds) {
  final hours = elapsedSeconds ~/ hour;
  final minutes = (elapsedSeconds % hour) ~/ minute;
  final secs = (elapsedSeconds % hour) % minute;

  String timeString = '';

  if (hours > 0) {
    timeString += '$hours:';
  }
  if (hours > 0 && minutes < 10) {
    timeString += '0$minutes:';
  } else {
    timeString += '$minutes:';
  }
  if (secs < 10) {
    timeString += '0$secs';
  } else {
    timeString += secs.toString();
  }

  return timeString;
}
