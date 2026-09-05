import 'package:app/utils/logger/logger.dart';
import 'package:hydrated_bloc/hydrated_bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:json_annotation/json_annotation.dart';

part 'preferences_state.dart';
part 'preferences_cubit.g.dart';

class PreferencesCubit extends HydratedCubit<PreferencesState> {
  PreferencesCubit() : super(const PreferencesState());
  
  void setIsDarkMode({required bool isDarkMode}) {
    emit(state.copyWith(isDarkMode: isDarkMode));
  }

  void setAutoCandidateMode({required bool autoCandidateMode}) {
    emit(state.copyWith(autoCandidateModeOn: autoCandidateMode));
  }

  @override
  PreferencesState? fromJson(Map<String, dynamic> json) {
    try {
      return PreferencesState.fromJson(json);
    } catch (e) {
      logger.e(e);
      return null;
    }
  }

  @override
  Map<String, dynamic>? toJson(PreferencesState state) {
    return state.toJson();
  }
}
