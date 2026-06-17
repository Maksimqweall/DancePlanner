import { View, Text } from 'react-native';

interface ProgressBarProps {
  spent: number;
  limit: number;
}

export default function ProgressBar({ spent, limit }: ProgressBarProps) {
  // Вычисляем процент заполнения (не больше 100%)
  const percentage = Math.min((spent / limit) * 100, 100);
  const isOverBudget = spent > limit;

  return (
    <View className="bg-zinc-800 p-5 rounded-3xl mb-6">
      <View className="flex-row justify-between mb-2">
        <Text className="text-zinc-400 font-medium">Бюджет месяца</Text>
        <Text className="text-white font-bold">{spent} / {limit} €</Text>
      </View>
      
      {/* Серый фон полоски */}
      <View className="h-3 bg-zinc-700 rounded-full overflow-hidden">
        {/* Закрашенная часть (динамическая ширина) */}
        <View 
          className={`h-full rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </View>

      {isOverBudget && (
        <Text className="text-red-400 text-xs mt-2 text-right">Лимит превышен!</Text>
      )}
    </View>
  );
}