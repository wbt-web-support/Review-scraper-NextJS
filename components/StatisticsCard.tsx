interface ChangeData {
  value: string;
  isPositive: boolean;
  label: string;
}

interface StatisticsCardProps {
  title: string;
  value: string;
  icon: string;
  change: ChangeData | null;
  iconBgClass: string;
  iconTextClass: string;
  isLoading?: boolean;
}

const StatisticsCard = ({
  title,
  value,
  icon,
  change,
  iconBgClass,
  iconTextClass,
  isLoading = false,
}: StatisticsCardProps) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 review-widget-slide-in">
      {isLoading ? (
        <div className="animate-pulse">
          <div className="flex items-center justify-between">
            <div className="w-24 h-6 bg-gray-200 rounded"></div>
            <div className={`w-10 h-10 rounded-lg ${iconBgClass}`}></div>
          </div>
          <div className="w-16 h-8 bg-gray-200 rounded mt-1"></div>
          <div className="w-24 h-4 bg-gray-200 rounded mt-3"></div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">{title}</p>
              <h3 className="text-2xl font-bold mt-1 text-gray-800">{value}</h3>
            </div>
            <div className={`w-10 h-10 rounded-lg ${iconBgClass} flex items-center justify-center ${iconTextClass}`}>
              <i className={`fas fa-${icon}`}></i>
            </div>
          </div>
          {change && (
            <div className="mt-3 flex items-center">
              <span className={`${change.isPositive ? 'text-success-500' : 'text-danger-500'} text-sm font-medium flex items-center`}>
                <i className={`fas fa-arrow-${change.isPositive ? 'up' : 'down'} mr-1 text-xs`}></i>
                {change.value}
              </span>
              <span className="text-gray-500 text-sm ml-2">{change.label}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StatisticsCard;
