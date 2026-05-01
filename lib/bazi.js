/**
 * 八字五行计算库
 * 基于蔡勒公式计算日干，配合农历转换
 */

// 天干
const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// 地支
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 五行对应天干索引 (0-9)
const WUXING_TIANGAN = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];

// 五行对应地支索引
const WUXING_DIZHI = {
    '子': '水', '丑': '土', '寅': '木', '卯': '木',
    '辰': '土', '巳': '火', '午': '火', '未': '土',
    '申': '金', '酉': '金', '戌': '土', '亥': '水'
};

// 五行
const WUXING = ['木', '火', '土', '金', '水'];

// 农历月份天数（简化版，1900-2100）
const LUNAR_INFO = {
    1900: [0, 2, 0, 2, 1, 2, 1, 2, 1, 2, 1, 2, 0],
    // ... 简化处理：实际使用更完整的农历库
};

/**
 * 获取某年农历正月初一到当年年末的累计天数
 */
function getLunarYearDays(year) {
    const baseYear = 1900;
    const days = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

    // 计算闰月（简化，实际需要查表）
    let leapMonth = 0;

    // 粗略计算年份差异
    const yearDiff = year - baseYear;
    let lunarDays = yearDiff * 365 + Math.floor(yearDiff / 4);

    return lunarDays;
}

/**
 * 蔡勒公式计算日干
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} day 1-31
 * @returns {object} {gan, zhi, wuxing}
 */
function getDayGanZhi(year, month, day) {
    // 蔡勒公式
    let y = year;
    let m = month;

    // 月份调整：1月和2月看作上一年的13月和14月
    if (m <= 2) {
        y -= 1;
        m += 12;
    }

    const a = Math.floor(y / 100);
    const b = Math.floor(a / 4);
    const c = 2 - a + b;
    const e = Math.floor(365.25 * (y + 4716));
    const f = Math.floor(30.6001 * (m + 1));
    const jd = c + day + e + f - 1524.5;

    // 计算儒略日
    const jd0 = Math.floor(jd + 0.5);

    // 计算日干支（以1984年1月1日甲子日为基准）
    const baseDate = new Date(1984, 0, 1);
    const targetDate = new Date(year, month - 1, day);
    const daysDiff = Math.floor((targetDate - baseDate) / (1000 * 60 * 60 * 24));

    // 日干索引：甲子=0, 乙丑=1, ...
    const ganIndex = ((daysDiff % 10) + 10) % 10;
    const zhiIndex = ((daysDiff % 12) + 12) % 12;

    return {
        gan: TIANGAN[ganIndex],
        zhi: DIZHI[zhiIndex],
        wuxing: WUXING_TIANGAN[ganIndex]
    };
}

/**
 * 计算年干
 * @param {number} year
 * @returns {string} 年干
 */
function getYearGan(year) {
    // 年干公式：(年份 - 4) % 10
    // 1984年是甲子年
    const ganIndex = ((year - 4) % 10 + 10) % 10;
    return TIANGAN[ganIndex];
}

/**
 * 计算年支
 * @param {number} year
 * @returns {string} 年支
 */
function getYearZhi(year) {
    const zhiIndex = ((year - 4) % 12 + 12) % 12;
    return DIZHI[zhiIndex];
}

/**
 * 计算月干（需要日干和月支）
 * @param {number} year
 * @param {number} month 1-12
 * @returns {string} 月干
 */
function getMonthGan(year, month) {
    // 月干公式：年干对应起点 + 月序号
    const yearGanIndex = ((year - 4) % 10 + 10) % 10;

    // 月干对应表
    const monthGanTable = [
        ['丙', '戊', '庚', '辛', '壬', '甲', '乙', '丙', '丁', '戊'],  // 年干甲/乙
        ['戊', '庚', '辛', '壬', '甲', '乙', '丙', '丁', '戊', '己'],  // 年干丙/丁
        ['庚', '辛', '壬', '甲', '乙', '丙', '丁', '戊', '己', '庚'],  // 年干戊/己
        ['辛', '壬', '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛'],  // 年干庚/辛
        ['壬', '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬'],  // 年干壬/癸
    ];

    const tableRow = Math.floor(yearGanIndex / 2);
    return monthGanTable[tableRow][month - 1];
}

/**
 * 计算八字
 * @param {string} birthday 格式：YYYY-MM-DD
 * @returns {object} 八字信息
 */
function calculateBazi(birthday) {
    const date = new Date(birthday);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // 计算年柱
    const yearGan = getYearGan(year);
    const yearZhi = getYearZhi(year);
    const yearWuxing = WUXING_TIANGAN[(year - 4) % 10 < 0 ? ((year - 4) % 10 + 10) % 10 : (year - 4) % 10];

    // 计算月柱
    const monthGan = getMonthGan(year, month);
    const monthZhi = DIZHI[(month + 1) % 12 === 0 ? 11 : (month + 1) % 12 - 1]; // 寅月=1, 卯月=2, ...

    // 月支正确映射
    const monthZhiMap = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
    const monthZhiFixed = monthZhiMap[month - 1];

    // 计算日柱
    const dayResult = getDayGanZhi(year, month, day);

    // 时柱（简化：12个时辰对应12地支）
    const hourZhi = DIZHI[Math.floor(date.getHours() / 2) % 12];

    // 五行统计
    const wuxingCount = {
        '木': 0, '火': 0, '土': 0, '金': 0, '水': 0
    };

    // 年柱五行
    wuxingCount[yearWuxing]++;
    wuxingCount[WUXING_DIZHI[yearZhi]]++;

    // 月柱五行
    const monthGanWuxing = WUXING_TIANGAN[TIANGAN.indexOf(monthGan)];
    wuxingCount[monthGanWuxing]++;
    wuxingCount[WUXING_DIZHI[monthZhiFixed]]++;

    // 日柱五行
    wuxingCount[dayResult.wuxing]++;
    wuxingCount[WUXING_DIZHI[dayResult.zhi]]++;

    // 时柱五行
    wuxingCount[WUXING_DIZHI[hourZhi]]++;

    // 找出最强和最弱的五行
    let maxWuxing = '木', minWuxing = '木';
    let maxCount = 0, minCount = 6;

    for (const [w, c] of Object.entries(wuxingCount)) {
        if (c > maxCount) {
            maxCount = c;
            maxWuxing = w;
        }
        if (c < minCount) {
            minCount = c;
            minWuxing = w;
        }
    }

    // 计算日主（我）的五行
    const riZhu = dayResult.gan;
    const riZhuWuxing = dayResult.wuxing;

    // 分析喜用神（简化版）
    const analysis = analyzeWuxing(riZhuWuxing, wuxingCount);

    return {
        year: yearGan + yearZhi,
        month: monthGan + monthZhiFixed,
        day: dayResult.gan + dayResult.zhi,
        hour: hourZhi,
        riZhu: riZhu,
        riZhuWuxing: riZhuWuxing,
        wuxingCount: wuxingCount,
        strongest: maxWuxing,
        weakest: minWuxing,
        analysis: analysis,
        birthday: birthday
    };
}

/**
 * 分析五行强弱和喜用神
 * @param {string} riZhuWuxing 日主五行
 * @param {object} wuxingCount 五行计数
 * @returns {object} 分析结果
 */
function analyzeWuxing(riZhuWuxing, wuxingCount) {
    // 简化的喜用神判断
    // 根据日主五行和八字中五行分布判断

    const total = Object.values(wuxingCount).reduce((a, b) => a + b, 0);

    // 计算各五行占比
    const ratio = {};
    for (const [w, c] of Object.entries(wuxingCount)) {
        ratio[w] = c / total;
    }

    // 判断日主强弱（简化）
    const riZhuRatio = ratio[riZhuWuxing];
    let strength = '中和';
    if (riZhuRatio >= 0.25) strength = '强';
    else if (riZhuRatio <= 0.12) strength = '弱';

    // 喜用神（简化版：补日主所生或日主所克的）
    let xiYongShen = [];

    // 木日主
    if (riZhuWuxing === '木') {
        if (ratio['水'] < ratio['金']) xiYongShen.push('水');
        if (ratio['木'] < 0.2) xiYongShen.push('木');
        if (ratio['火'] < ratio['水']) xiYongShen.push('火');
    }
    // 火日主
    else if (riZhuWuxing === '火') {
        if (ratio['木'] < ratio['水']) xiYongShen.push('木');
        if (ratio['火'] < 0.2) xiYongShen.push('火');
        if (ratio['土'] < ratio['金']) xiYongShen.push('土');
    }
    // 土日主
    else if (riZhuWuxing === '土') {
        if (ratio['火'] < ratio['木']) xiYongShen.push('火');
        if (ratio['土'] < 0.2) xiYongShen.push('土');
        if (ratio['金'] < ratio['火']) xiYongShen.push('金');
    }
    // 金日主
    else if (riZhuWuxing === '金') {
        if (ratio['土'] < ratio['木']) xiYongShen.push('土');
        if (ratio['金'] < 0.2) xiYongShen.push('金');
        if (ratio['水'] < ratio['火']) xiYongShen.push('水');
    }
    // 水日主
    else if (riZhuWuxing === '水') {
        if (ratio['金'] < ratio['土']) xiYongShen.push('金');
        if (ratio['水'] < 0.2) xiYongShen.push('水');
        if (ratio['木'] < ratio['金']) xiYongShen.push('木');
    }

    // 如果没有合适的，选择最少的五行
    if (xiYongShen.length === 0) {
        let min = 6, minW = '';
        for (const [w, c] of Object.entries(wuxingCount)) {
            if (c < min) {
                min = c;
                minW = w;
            }
        }
        xiYongShen.push(minW);
    }

    // 忌讳（与喜用神相反）
    const jiHuan = [];
    if (!xiYongShen.includes('木')) jiHuan.push('木');
    if (!xiYongShen.includes('火')) jiHuan.push('火');
    if (!xiYongShen.includes('土')) jiHuan.push('土');
    if (!xiYongShen.includes('金')) jiHuan.push('金');
    if (!xiYongShen.includes('水')) jiHuan.push('水');

    return {
        riZhuStrength: strength,
        xiYongShen: xiYongShen.slice(0, 2),
        jiHuan: jiHuan.slice(0, 2),
        recommendation: getRecommendation(xiYongShen[0])
    };
}

/**
 * 获取手串推荐
 * @param {string} wuxing 五行
 * @returns {object} 推荐信息
 */
function getRecommendation(wuxing) {
    const recs = {
        '木': {
            element: '木',
            name: '绿檀念珠',
            desc: '天然绿檀木，象征生机与成长，助旺事业运和人际关系'
        },
        '火': {
            element: '火',
            name: '南红玛瑙',
            desc: '南红玛瑙制作，象征热情与活力，增强行动力和创造力'
        },
        '土': {
            element: '土',
            name: '黄玉髓',
            desc: '黄玉髓精制，寓意稳重踏实，提升稳定性和包容力'
        },
        '金': {
            element: '金',
            name: '黄金檀木',
            desc: '精选黄金檀木，寓意招财纳福，增强决断力和领导力'
        },
        '水': {
            element: '水',
            name: '深海蓝晶',
            desc: '深海蓝晶石，代表智慧与灵动，提升直觉和沟通能力'
        }
    };

    return recs[wuxing] || recs['木'];
}

module.exports = {
    calculateBazi,
    getRecommendation,
    TIANGAN,
    DIZHI,
    WUXING
};
