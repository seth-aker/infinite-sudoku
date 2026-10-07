import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

part 'timer_state.dart';
part 'timer_event.dart';

class TimerBloc extends Bloc<TimerEvent, TimerState> {
  StreamSubscription<void>? _tickerSubscription;
  TimerBloc() : super(const TimerInitialState()) {
    on<TimerStarted>(_onTimerStarted);
    on<TimerPaused>(_onTimerPaused);
    on<TimerReset>(_onTimerReset);
    on<_TimerTicked>(_onTimerTicked);
  }

  void _onTimerStarted(TimerStarted event, Emitter<TimerState> emit) {
    // Make sure its closed
    _tickerSubscription?.cancel();

    emit(TimerPlayingState(elapsedSeconds: event.seconds));

    _tickerSubscription = tickerStream().listen((_) {
      add(_TimerTicked());
    });
  }

  void _onTimerPaused(TimerPaused event, Emitter<TimerState> emit) {
    if (state is TimerPlayingState) {
      _tickerSubscription?.pause();
      emit(TimerPausedState(elapsedSeconds: state.elapsedSeconds));
    }
  }

  void _onTimerReset(TimerReset event, Emitter<TimerState> emit) {
    _tickerSubscription?.cancel();
    emit(const TimerInitialState());
  }

  @override
  Future<void> close() {
    _tickerSubscription?.cancel();
    return super.close();
  }

  void _onTimerTicked(_TimerTicked event, Emitter<TimerState> emit) {
    emit(TimerPlayingState(elapsedSeconds: state.elapsedSeconds + 1));
  }

  Stream<void> tickerStream() {
    return Stream.periodic(Duration(seconds: 1));
  }
}
