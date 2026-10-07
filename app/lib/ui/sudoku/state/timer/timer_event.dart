part of 'timer_bloc.dart';

abstract class TimerEvent {
  const TimerEvent();
}

class TimerStarted extends TimerEvent {
  final int seconds;
  const TimerStarted({required this.seconds});
}

class TimerPaused extends TimerEvent {
  const TimerPaused();
}

class TimerReset extends TimerEvent {
  const TimerReset();
}

class _TimerTicked extends TimerEvent {}
