export interface Live2DModelEntry {
    slug: string;
    name: string;
    image: string;
    modelPath: string;
    note?: string;
    // moc3 中 Y 轴方向相反（建模时画反），渲染时需要把 ParamAngleY / ParamBodyAngleY 取反
    flipY?: boolean;
}

export const live2dModels: Live2DModelEntry[] = [
    {
        slug: "inni-sleep",
        name: "inni_sleep",
        image: "/images/inni/inni-sleep-cover.png",
        modelPath: "/images/inni/live2d/inni_sleep/input1.model3.json",
        note: `这个inni宝宝非常的萌,我当时在想,如果inni在我的博客里面的话,可能晚上会睡觉,并且会像狐狸一样把自己蜷缩在一起睡觉,于是就诞生了此图,也是使用gpt image-2生成的,并且我发现了一个拆分图层的一个项目,https://github.com/shitagaki-lab/see-through.git,感谢这个项目,我租了一个3090服务器,在服务器上把这个项目跑起来就可以实现简单的拆分了,但是做live2d需要更精细一点的拆分,这个时候ps就可以派上用场了,大多数时候是把图层分的更碎一点,这个样子做live2d更好变换一点,并且也学会了物理模拟,虽然有的地方做的变换还是很奇怪吧,比如说那个头饰,我做完发现应该拆分一下,分成左发饰和右发饰,并且图层关系应该是右发饰在前发的上面,而且尾巴哪里的遮挡关系也很奇怪,这一块还没有想好怎么处理,但是真的很感谢see-through这个项目`,
    },
    {
        slug: "inni-box",
        name: "inni_box",
        image: "/images/inni/inni-box-cover.png",
        modelPath: "/images/inni/live2d/inni_box/livefox.model3.json",
        flipY: true,
    },
    {
        slug: "inni-cat",
        name: "inni_cat",
        image: "/images/inni/inni-cat-cover.png",
        modelPath: "/images/inni/live2d/inni_cat/inni_cat.model3.json",
    },
];
