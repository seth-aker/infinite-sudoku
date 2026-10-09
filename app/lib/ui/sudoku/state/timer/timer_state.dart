part of 'timer_bloc.dart';

sealed class TimerState extends Equatable {
  final int elapsedSeconds;
  const TimerState({required this.elapsedSeconds});
  @override
  List<Object?> get props => [elapsedSeconds];
}

class TimerInitialState extends TimerState {
  const TimerInitialState() : super(elapsedSeconds: 0);

  @override
  List<Object?> get props => [elapsedSeconds];
}

class TimerPlayingState extends TimerState {
  const TimerPlayingState({required super.elapsedSeconds});

  TimerPlayingState copyWith({int? elapsedSeconds}) {
    return TimerPlayingState(
      elapsedSeconds: elapsedSeconds ?? this.elapsedSeconds,
    );
  }

  @override
  List<Object?> get props => [elapsedSeconds];
}

class TimerPausedState extends TimerState {
  const TimerPausedState({required super.elapsedSeconds});

  TimerPausedState copyWith({int? elapsedSeconds}) {
    return TimerPausedState(
      elapsedSeconds: elapsedSeconds ?? this.elapsedSeconds,
    );
  }

  @override
  List<Object?> get props => [elapsedSeconds];
}

class TimerOverState extends TimerState {
  const TimerOverState({required super.elapsedSeconds});

  TimerOverState copyWith({int? elapsedSeconds}) {
    return TimerOverState(
      elapsedSeconds: elapsedSeconds ?? this.elapsedSeconds,
    );
  }

  @override
  List<Object?> get props => [elapsedSeconds];
}
