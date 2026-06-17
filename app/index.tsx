import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useFinanceStore } from '../store/useFinanceStore';
import TransactionCard from '../components/TransactionCard';
import ProgressBar from '../components/ProgressBar';

export default function Index() {
  // Вытаскиваем данные и функции из нашего локального хранилища
  const { transactions, addTransaction, getTotalSpent } = useFinanceStore();
  const totalSpent = getTotalSpent();
  const monthlyLimit = 1000; // В будущем будем задавать это в настройках профиля

  // Функция-заглушка для теста
  const addDummyTransaction = () => {
    addTransaction(150, 'HOTEL', 'Отель на турнир');
  };

  return (
    <ScrollView className="flex-1 bg-zinc-900 px-4 pt-12">
      <Text className="text-3xl text-white font-bold mb-6">Дашборд</Text>
      
      {/* Наш прогресс-бар */}
      <ProgressBar spent={totalSpent} limit={monthlyLimit} />

      {/* Заголовок и кнопка добавления */}
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-xl text-white font-semibold">Последние траты</Text>
        
        {/* Кнопка, которая пишет в базу данных */}
        <TouchableOpacity 
          className="bg-emerald-500 px-4 py-2 rounded-xl"
          onPress={addDummyTransaction}
        >
          <Text className="text-white font-bold">+ Тест</Text>
        </TouchableOpacity>
      </View>

      {/* Рендер списка транзакций */}
      {transactions.length === 0 ? (
        <Text className="text-zinc-500 text-center mt-10">Пока нет трат. Сделайте первую запись!</Text>
      ) : (
        transactions.map((tx) => (
          <TransactionCard key={tx.id} transaction={tx} />
        ))
      )}
      
      {/* Отступ снизу для красоты */}
      <View className="h-10" />
    </ScrollView>
  );
}