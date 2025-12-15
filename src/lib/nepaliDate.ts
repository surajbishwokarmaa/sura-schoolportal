import NepaliDate from 'nepali-date-converter';

export function toNepaliDate(date: Date | string): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const nepaliDate = new NepaliDate(d);
    return nepaliDate.format('YYYY-MM-DD');
  } catch (error) {
    console.error('Error converting to Nepali date:', error);
    return '';
  }
}

export function toNepaliDateFormatted(date: Date | string): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const nepaliDate = new NepaliDate(d);
    return nepaliDate.format('YYYY/MM/DD');
  } catch (error) {
    console.error('Error converting to Nepali date:', error);
    return '';
  }
}

export function getNepaliMonthName(month: number): string {
  const months = [
    'बैशाख', 'जेठ', 'असार', 'श्रावण', 'भदौ', 'असोज',
    'कार्तिक', 'मंसिर', 'पुष', 'माघ', 'फाल्गुन', 'चैत्र'
  ];
  return months[month - 1] || '';
}

export function formatNepaliDateNative(date: Date | string): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const nepaliDate = new NepaliDate(d);
    const year = nepaliDate.getYear();
    const month = nepaliDate.getMonth() + 1;
    const day = nepaliDate.getDate();
    
    const nepaliNumerals = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    const toNepaliNumeral = (num: number): string => {
      return num.toString().split('').map(digit => nepaliNumerals[parseInt(digit)]).join('');
    };
    
    return `${toNepaliNumeral(year)}-${toNepaliNumeral(month).padStart(2, '०')}-${toNepaliNumeral(day).padStart(2, '०')}`;
  } catch (error) {
    console.error('Error converting to Nepali date:', error);
    return '';
  }
}

export function getCurrentNepaliDate(): { nepali: string; english: string } {
  const now = new Date();
  return {
    nepali: toNepaliDateFormatted(now),
    english: now.toISOString().split('T')[0]
  };
}

export function getCurrentNepaliYear(): number {
  try {
    const nepaliDate = new NepaliDate(new Date());
    return nepaliDate.getYear();
  } catch (error) {
    // Fallback calculation: AD year + 56/57
    const now = new Date();
    const adYear = now.getFullYear();
    const month = now.getMonth();
    // Nepali new year is mid-April, so before April add 56, after add 57
    return adYear + (month >= 3 ? 57 : 56);
  }
}

export function formatDualDate(date: Date | string): { nepali: string; english: string } {
  const d = typeof date === 'string' ? new Date(date) : date;
  return {
    nepali: toNepaliDateFormatted(d),
    english: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  };
}
