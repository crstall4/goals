import styles from './GoalItem.module.css';

export default function GoalItem({ id, label, icon, frequency, checked, onChange }) {
  return (
    <label className={`${styles.item} ${checked ? styles.checked : ''}`} htmlFor={`goal-${id}`}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{label}</span>
      {frequency === 'weekly' && (
        <span className={styles.freqBadge}>weekly</span>
      )}
      <input
        id={`goal-${id}`}
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        onChange={(e) => onChange(id, e.target.checked)}
      />
      <span className={styles.box} />
    </label>
  );
}
