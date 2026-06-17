import { View, Text } from 'react-native';
import { Transaction } from '../store/useFinanceStore';

// Маппинг цветов и иконок для разных категорий
const categoryConfig = {
  HOTEL: { icon: '🏨', color: 'bg-blue-500' },
  ENTRY_FEE: { icon: '🎫', color: 'bg-purple-500' },
  TRAVEL: { icon: '✈️', color: 'bg-amber-500' },
  DRESS: { icon: '👗', color: 'bg-pink-500' },
  LESSON: { icon: '💃', color: 'bg-emerald-500' },
  OTHER: { icon: '📦', color: 'bg-gray-500' },
};

export default function TransactionCard({ transaction }: { transaction: Transaction }) {
  const config = categoryConfig[transaction.category] || categoryConfig.OTHER;
  
  // Форматируем дату в читаемый вид
  const date = new Date(transaction.date).toLocaleDateString('ru-RU', { 
    day: 'numeric', 
    month: 'short' 
  });

  return (
    <View className="flex-row items-center justify-between p-4 mb-3 bg-zinc-800 rounded-2xl">
      <View className="flex-row items-center flex-1">
        {/* Иконка категории */}
        <View className={`w-12 h-12 rounded-full items-center justify-center ${config.color}`}>
          <Text className="text-xl">{config.icon}</Text>
        </View>
        
        {/* Описание и дата */}
        <View className="ml-4 flex-1">
          <Text className="text-white font-semibold text-lg" numberOfLines={1}>
            {transaction.description}
          </Text>
          <Text className="text-zinc-400 text-sm">{date}</Text>
        </View>
      </View>
      
      {/* Сумма */}
      <Text className="text-white font-bold text-lg ml-2">-{transaction.amount} €</Text>
    </View>
  );
}