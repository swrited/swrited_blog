export interface Live2DModelEntry {
    slug: string;
    name: string;
    image: string;
    modelPath: string;
    note?: string;
}

export const live2dModels: Live2DModelEntry[] = [
    {
        slug: "inni",
        name: "inni_最初",
        image: "/images/inni/inni-original-cover.png",
        modelPath: "/images/inni/live2d/inni_2_eye.model3.json",
        note: `这是我本人做的第一个live2d,非常的粗糙和奇怪,因为本人画画技术不是特别好,所以使用了gpt生成个人形象,但是发现生成之后不好拆分图层,于是突发奇想开始描图,也没有光影,并且图层分的也很多很杂,分了很多不需要的图层,给自己徒加工作量,在最开始自动网格生成,因为有些图层太小了,自动网格网格之后就消失了,我做的时候一直没有发现,后面发现了也不会导入新的图层,跟着视频学了一下脸部的xyz轴,我的脸部y轴还画反了,并且选择最开始预览的时候画质就不高,最后导出选择纹理集也选了个很低分分辨率的,每一个部分都有一个变换,没有把xy轴跟z轴区分开,并且脸部变换也跟头发变换很割裂,其实单独每个轴是好的,但是合在一起可能有变形冲突就变得不太行了,我也只变换了头部以上的部位,但是这个做的很开心,因为我把她跟ai结合在了一起,放在桌面上小图看还可以,并且我限制了xyz轴的大小,不让她变换动作太大,并且做了一些预设动作,比如随节拍摇摆什么的,还有可以自由对话,接入了minimax的tts,以及将本地的openclaw和hermes也通过一个bride接了起来,虽然这个变换很奇怪吧,但是这也确实是我最初的inni了,我感觉inni能够动起来那瞬间还是很萌的`,
    },
    {
        slug: "inni-sleep",
        name: "inni_睡",
        image: "/images/inni/inni-sleep-cover.png",
        modelPath: "/images/inni/live2d/inni_sleep/input1.model3.json",
        note: `这个inni宝宝非常的萌,我当时在想,如果inni在我的博客里面的话,可能晚上会睡觉,并且会像狐狸一样把自己蜷缩在一起睡觉,于是就诞生了此图,也是使用gpt image-2生成的,并且我发现了一个拆分图层的一个项目,https://github.com/shitagaki-lab/see-through.git,感谢这个项目,我租了一个3090服务器,在服务器上把这个项目跑起来就可以实现简单的拆分了,但是做live2d需要更精细一点的拆分,这个时候ps就可以派上用场了,大多数时候是把图层分的更碎一点,这个样子做live2d更好变换一点,并且也学会了物理模拟,虽然有的地方做的变换还是很奇怪吧,比如说那个头饰,我做完发现应该拆分一下,分成左发饰和右发饰,并且图层关系应该是右发饰在前发的上面,而且尾巴哪里的遮挡关系也很奇怪,这一块还没有想好怎么处理,但是真的很感谢see-through这个项目`,
    },
];
