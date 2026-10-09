part of 'preferences_cubit.dart';

@JsonSerializable()
class PreferencesState extends Equatable {
  final bool isDarkMode;
  final bool autoCandidateModeOn;

  const PreferencesState({
    this.isDarkMode = false,
    this.autoCandidateModeOn = false,
  });

  PreferencesState copyWith({
    bool? isDarkMode,
    bool? autoCandidateModeOn,
    }) => PreferencesState(
      isDarkMode: isDarkMode ?? this.isDarkMode,
      autoCandidateModeOn: autoCandidateModeOn ?? this.autoCandidateModeOn
    );

  factory PreferencesState.fromJson(Map<String, dynamic> json) => _$PreferencesStateFromJson(json);

  Map<String, dynamic> toJson() => _$PreferencesStateToJson(this);

  @override
  List<Object?> get props => [isDarkMode, autoCandidateModeOn];
}
